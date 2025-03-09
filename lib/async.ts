// Copyright (C) 2024 Wyden and Gyre, LLC
import { deadline } from "jsr:@std/async@^1.0.10";
import { pooledMap } from "jsr:@std/async@^1.0.10";

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
  outlineFlag: string;
  private constructor(threads: readonly Thread<I, O>[], jobDeadline: number) {
    this.#threads = threads.map((thread) => ({ thread, busy: false }));
    this.#jobDeadline = jobDeadline;
  }

  static async create<I, O>(
    workerSpecifier: string | URL,
    initData: unknown,
    outlineFlag: string,
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
          threads[i] = await Thread.spawn<I, O>(workerSpecifier, initData, outlineFlag);
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

  async *process(is: AsyncIterable<I>, outlineFlag: string): AsyncIterable<O> {
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
    outlineFlag: string,
  ): Promise<Thread<I, O>> {
    const w = new Worker(workerSpecifier, { type: "module" });
    const p = new Promise<Thread<I, O>>((resolve, reject) => {
      w.onmessage = () => resolve(new Thread(w));
      w.onerror = reject;
      w.onmessageerror = reject;
    });
    self.outlineFlag = outlineFlag;
    w.postMessage(initMessage);
    return p;
  }

  process(data: I): Promise<O> {
    const p = new Promise<O>((resolve, reject) => {
      this.#worker.onmessage = ({ data }) => resolve(data);
      this.#worker.onerror = reject;
      this.#worker.onmessageerror = reject;
    });
    data.outlineFlag = self.outlineFlag;
    this.#worker.postMessage(data);
    return p;
  }

  kill(): void {
    this.#worker.terminate();
  }
}
