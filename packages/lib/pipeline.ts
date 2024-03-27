// Copyright (C) 2023 Wyden and Gyre, LLC
import { ocr } from "./ocr.js";
import { parse } from "./parse.js";
import { srt } from "./srt.js";
import { iterOds, packetize, pgsSchema } from "./transform.js";

export type Progress = {
	completed: number;
	total: number;
};

export async function* pipeline(
	pgs: Uint8Array,
	workerURL: URL,
	wasmBinary: Uint8Array,
	trainedData: Uint8Array,
): AsyncGenerator<[Progress, string], number[]> {
	const total = pgs.length;
	const result = parse(pgs);
	const basicParsed = pgsSchema.parse(result);
	const parsedSegments = basicParsed.segment;
	const groupedSegments = packetize(parsedSegments);
	const unrendered = iterOds(groupedSegments);
	// Unrendered has offset
	const ocrd = ocr(workerURL, wasmBinary, trainedData, unrendered);
	const srtIter = srt(ocrd);
	let next = await srtIter.next();
	while (!next.done) {
		const completed = 0; // TODO: completed byte
		yield [{ completed, total }, next.value];
		next = await srtIter.next();
	}
	return next.value;
}
