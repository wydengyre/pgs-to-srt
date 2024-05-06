// Copyright (C) 2024 Wyden and Gyre, LLC
import type {InitFn, RecognizeFn} from "@pgs-to-srt/worker/worker.js";
import type { Unrendered } from "./transform.js";
import { PromisePool } from "@supercharge/promise-pool";
import { type Remote, wrap } from "comlink";
import pTimeout from "p-timeout";

const TIME_ACCURACY_KHZ = 90;

export type Subtitle = {
	startTime: number;
	endTime: number;
	text: string;
};

export async function* ocr(
	workerSpecifier: string | URL,
	wasmBinary: Uint8Array,
	trainedData: Uint8Array,
	unrenderedIter: AsyncIterable<Unrendered>,
): AsyncIterableIterator<Subtitle> {
	// at the time of this comment, it was experimentally determined that 4
	// threads performs significantly better than 8 in Safari, with little
	// cost in Chrome and no notable cost in Firefox
	const maxThreads = 4;
	const threadCount = Math.min(navigator.hardwareConcurrency, maxThreads);

	const deadlinePerThreadMs = 1_000;
	const initDeadline = threadCount * deadlinePerThreadMs;

	const backingWorkers = new Array(threadCount);
	const workerInits: Promise<{ recognize: RecognizeFn }>[] = new Array(threadCount);
	for (let i = 0; i < threadCount; i++) {
		backingWorkers[i] = new Worker(workerSpecifier);
		const init: Remote<InitFn> = wrap(backingWorkers[i]);
		workerInits[i] = init(wasmBinary, trainedData);
	}
	const workers = await pTimeout(Promise.all(workerInits), { milliseconds: initDeadline });
	const free = workers.map(() => true);

	const { results } = await PromisePool
		.for(unrenderedIter)
		.withConcurrency(threadCount)
		.useCorrespondingResults()
		.process(async (unrendered) => {
			const i = free.indexOf(true);
			if (i === -1) {
				throw new Error("No free workers");
			}

			free[i] = false;
			const { recognize } = workers[i];
			const text = await recognize(unrendered);
			free[i] = true;

			let { startTime, endTime } = unrendered;
			startTime /= TIME_ACCURACY_KHZ;
			endTime /= TIME_ACCURACY_KHZ;
			return { startTime, endTime, text};
		});

	for (const worker of backingWorkers) {
		worker.terminate();
	}

	return results;
}
