// Copyright (C) 2023 Wyden and Gyre, LLC
import { deadline } from "std/async/deadline.ts";

export const ERROR_WHILE_MAPPING_MESSAGE = "Threw while mapping.";

export type PoolOptions = Readonly<{
  initDeadline: number;
  jobDeadline: number;
  threadCount: number;
}>;

export const defaultPoolOptions: PoolOptions = {
  initDeadline: 10_000,
  jobDeadline: 10_000,
  // we cap at 8 threads by default to avoid limits imposed by browsers:
  // https://stackoverflow.com/questions/13574158/number-of-web-workers-limit
  threadCount: Math.max(navigator.hardwareConcurrency, 8),
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

    // We spawn threads serially rather in parallel because:
    // 1. Simultaneous invocations of WebAssembly.instantiate from different web workers
    // seem to hang sometimes in Safari, at least when running the local server. There might be a race condition.
    // 2. As of this comment, we can't compile to a WebAssembly.Module and pass it off to the tesseract lib /
    // emscripten. This would be the preferable approach, saving us from repeating the initialization in our workers.
    const threads = Array(threadCount);

    let i = 0;
    try {
      await deadline((async () => {
        for (; i < threadCount; i++) {
          threads[i] = await Thread.spawn<I, O>(workerSpecifier, initData);
        }
      })(), initDeadline);
    } catch (e: unknown) {
      for (let j = 0; j < i; j++) {
        threads[j].kill();
      }
      if (e instanceof Error && e.name === "DeadlineError") {
        throw Error(`Failed to initialize thread pool within ${initDeadline}ms, frozen on thread ${i + 1}`,
          {cause: e});
      }
      throw e;
    }

    return new this(threads, jobDeadline);
  }

  async *process(is: AsyncIterable<I>): AsyncIterable<O> {
    const iteratorFn = async (i: I): Promise<O> => {
      const availableThread = this.availableThread()!;
      availableThread.busy = true;
      const processed = await deadline(
        availableThread.thread.process(i),
        this.#jobDeadline,
      );
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
    const w = new Worker(workerSpecifier, { type: "module" });
    const p = new Promise<Thread<I, O>>((resolve, reject) => {
      w.onmessage = () => resolve(new Thread(w));
      w.onerror = reject;
      w.onmessageerror = reject;
    });
    w.postMessage(initMessage);
    return p;
  }

  process(data: I): Promise<O> {
    const p = new Promise<O>((resolve, reject) => {
      this.#worker.onmessage = ({ data }) => resolve(data);
      this.#worker.onerror = reject;
      this.#worker.onmessageerror = reject;
    });
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
