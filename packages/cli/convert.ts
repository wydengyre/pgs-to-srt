import { writeAll } from "std/io/mod.ts";
import { toFileUrl } from "std/path/mod.ts";
// Copyright (C) 2024 Wyden and Gyre, LLC
import { pipeline } from "../lib/pipeline.ts";
import { render } from "./progress.ts";

export type Config = {
	trainedDataPath: string;
	wasmPath: string;
	workerPath: string;
	outWriter: Deno.Writer;
	errWriter: Deno.Writer;
};

export async function runConvert(
	sup: Uint8Array,
	config: Config,
): Promise<void> {
	const [wasmBinary, trainedData] = await Promise.all([
		Deno.readFile(config.wasmPath),
		Deno.readFile(config.trainedDataPath),
	]);

	const workerUrl = toFileUrl(config.workerPath);
	const srtIter = pipeline(sup, workerUrl, wasmBinary, trainedData);
	const te = new TextEncoder();
	let next = await srtIter.next();
	while (!next.done) {
		const [{ completed, total }, sub] = next.value;
		const bytes = te.encode(`${sub}\n`);
		await writeAll(config.outWriter, bytes);
		await render(config.errWriter, { completed, total });
		next = await srtIter.next();
	}

	const blanks = next.value;
	const blankCount = blanks.length;
	if (blankCount > 0) {
		const warnStr =
			blankCount > 1
				? `\n${blankCount} blank subtitles at indices ${blanks.join(", ")}`
				: `\n one blank subtitle at index ${blanks[0]}`;
		const bytes = te.encode(`${warnStr}\n`);
		await writeAll(config.errWriter, bytes);
	}
}
