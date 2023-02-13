// Copyright (C) 2023 Wyden and Gyre, LLC
import { deadline } from "std/async/deadline.ts";
import { deferred } from "std/async/deferred.ts";

export const ERROR_WHILE_MAPPING_MESSAGE = "Threw while mapping.";

export type PoolOptions = Readonly<{
  initDeadline: number;
  jobDeadline: number;
  threadCount: number;
}>;

export const defaultPoolOptions: PoolOptions = {
  initDeadline: 10_000,
  jobDeadline: 10_000,
  threadCount: navigator.hardwareConcurrency,
};

type ThreadWithStatus<I, O> = { thread: Thread<I, O>; busy: boolean };

export class Pool<I, O> {
  readonly #threads: readonly ThreadWithStatus<I, O>[];
  readonly #jobDeadline: number;

  private constructor(threads: readonly Thread<I, O>[], jobDeadline: number) {
    this.#threads = threads.map((thread) => ({ thread, busy: false }));
    this.#jobDeadline = jobDeadline;
  }

  static async create<I, O>(
    workerSpecifier: string | URL,
    initData: unknown,
    poolOptionOverrides?: Partial<PoolOptions>,
  ): Promise<Pool<I, O>> {
    const { threadCount, initDeadline, jobDeadline } = Object.assign({
      ...defaultPoolOptions,
    }, poolOptionOverrides ?? {});

    const threadPromises = [];
    for (let i = 0; i < threadCount; i++) {
      console.log(`spawning promise: ${i+1}/${threadCount}`);
      const threadPromise = deadline(
        Thread.spawn<I, O>(workerSpecifier, initData),
        initDeadline,
      );
      console.log(`spawned promise: ${i+1}/${threadCount}`);
      threadPromises.push(threadPromise);
    }

    const threads = await Promise.all(threadPromises);
    return new this(threads, jobDeadline);
  }

  async *process(is: AsyncIterable<I>): AsyncIterable<O> {
    const iteratorFn = async (i: I): Promise<O> => {
      console.log("get available thread");
      const availableThread = this.availableThread()!;
      availableThread.busy = true;
      console.log(`available thread: ${availableThread}`);
      console.log(`processing: ${i}`);
      const processed = await deadline(
        availableThread.thread.process(i),
        this.#jobDeadline,
      );
      console.log(`processed: ${i}`);
      availableThread.busy = false;
      return processed;
    };
    yield* pooledMap(this.#threads.length, is, iteratorFn);
  }

  kill(): void {
    for (const { thread } of this.#threads) {
      thread.kill();
    }
  }

  private availableThread(): ThreadWithStatus<I, O> | null {
    return this.#threads.find(({ busy }) => !busy) ?? null;
  }
}

export class Thread<I, O> {
  #worker: Worker;

  private constructor(worker: Worker) {
    this.#worker = worker;
  }

  static spawn<I, O>(
    workerSpecifier: string | URL,
    initMessage: unknown,
  ): Promise<Thread<I, O>> {
    const uuid = crypto.randomUUID();
    console.log(`spawn worker: ${uuid}`);
    const w = new Worker(workerSpecifier, { type: "module" });
    console.log(`spawned worker: ${uuid}`);
    const p = deferred<Thread<I, O>>();
    w.onmessage = () => {
      console.log(`got message: ${uuid}. resolving promise`);
      return p.resolve(new Thread(w));
    }
    w.onerror = p.reject;
    w.onmessageerror = p.reject;
    w.postMessage(initMessage);
    console.log(`returning promise: ${uuid}`);
    return p;
  }

  process(data: I): Promise<O> {
    const p = deferred<O>();
    this.#worker.onmessage = ({ data }) => p.resolve(data);
    this.#worker.onerror = p.reject;
    this.#worker.onmessageerror = p.reject;
    this.#worker.postMessage(data);
    return p;
  }

  kill(): void {
    this.#worker.terminate();
  }
}

// sadly we have to do a lot of copy-pasta here because the line at the end
// explodes in Chrome 103 (async iteration on ReadableStream is not supported)
// see https://bugs.chromium.org/p/chromium/issues/detail?id=929585
function pooledMap<T, R>(
  poolLimit: number,
  array: Iterable<T> | AsyncIterable<T>,
  iteratorFn: (data: T) => Promise<R>,
): AsyncIterableIterator<R> {
  // Create the async iterable that is returned from this function.
  const res = new TransformStream<Promise<R>, R>({
    async transform(
      p: Promise<R>,
      controller: TransformStreamDefaultController<R>,
    ) {
      try {
        const s = await p;
        controller.enqueue(s);
      } catch (e) {
        if (
          e instanceof AggregateError &&
          e.message == ERROR_WHILE_MAPPING_MESSAGE
        ) {
          controller.error(e as unknown);
        }
      }
    },
  });
  // Start processing items from the iterator
  (async () => {
    const writer = res.writable.getWriter();
    const executing: Array<Promise<unknown>> = [];
    try {
      for await (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        // Only write on success. If we `writer.write()` a rejected promise,
        // that will end the iteration. We don't want that yet. Instead let it
        // fail the race, taking us to the catch block where all currently
        // executing jobs are allowed to finish and all rejections among them
        // can be reported together.
        writer.write(p);
        const e: Promise<unknown> = p.then(() =>
          executing.splice(executing.indexOf(e), 1)
        );
        executing.push(e);
        if (executing.length >= poolLimit) {
          await Promise.race(executing);
        }
      }
      // Wait until all ongoing events have processed, then close the writer.
      await Promise.all(executing);
      writer.close();
    } catch {
      const errors = [];
      for (const result of await Promise.allSettled(executing)) {
        if (result.status == "rejected") {
          errors.push(result.reason);
        }
      }
      writer.write(Promise.reject(
        new AggregateError(errors, ERROR_WHILE_MAPPING_MESSAGE),
      )).catch(() => {});
    }
  })();
  return streamAsyncIterator(res.readable);
}

// from https://jakearchibald.com/2017/async-iterators-and-generators/#making-streams-iterate
async function* streamAsyncIterator<T>(
  stream: ReadableStream<T>,
): AsyncIterableIterator<T> {
  // Get a lock on the stream
  const reader = stream.getReader();

  try {
    while (true) {
      // Read from the stream
      const { done, value } = await reader.read();
      // Exit if we're done
      if (done) return;
      // Else yield the chunk
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
