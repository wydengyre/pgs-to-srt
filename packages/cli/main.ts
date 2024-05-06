// Copyright (C) 2024 Wyden and Gyre, LLC
import { readAll } from "std/io/mod.ts";
import * as path from "std/path/mod.ts";
import buildConfig from "./build.json" with { type: "json" };
import devConfig from "./conf.dev.json" with { type: "json" };
import { runConvert } from "./convert.ts";
import { extractImage } from "./extract-image.ts";

const USAGE = "[LANGUAGE | SUBTITLE_INDEX]";

function fail(err?: string): never {
	if (err !== undefined) {
		console.error(err);
	}
	console.error(`arguments: ${USAGE}`);

	const ARBITRARY_EXIT_CODE = 1;
	Deno.exit(ARBITRARY_EXIT_CODE);
}

if (import.meta.main) {
	await main(Deno.args, Deno.stdin, Deno.stdout, Deno.stderr);
}

async function main(
	args: string[],
	inReader: Deno.Reader,
	outWriter: Deno.Writer,
	errWriter: Deno.Writer,
): Promise<void> {
	if (args.length < 2) {
		fail();
	}

	const [wasmPath, workerPath] = isDev()
		? [relativePath(devConfig.wasmPath), relativePath(devConfig.workerPath)]
		: [
				relativePath(buildConfig.tesseractWasmBundle),
				relativePath(buildConfig.workerBundle),
			];

	const [trainedDataPathOrIndex, supPath] = args;

	const supReader = supPath === "-" ? inReader : await Deno.open(supPath);

	// it feels kind of stupid that we don't support streaming this,
	// but these files tend to be in the tens of megabytes
	const sup = await readAll(supReader);

	const index = Number.parseInt(trainedDataPathOrIndex, 10);
	return isNaN(index)
		? runConvert(sup, {
				trainedDataPath: trainedDataPathOrIndex,
				wasmPath,
				workerPath,
				outWriter,
				errWriter,
			})
		: extractImage(sup, index, outWriter);
}

function isDev(): boolean {
	const mainName = path.basename(buildConfig["main"]);
	const thisModuleName = path.basename(Deno.mainModule);
	return thisModuleName === mainName;
}

function relativePath(p: string): string {
	const mainDir = path.dirname(path.fromFileUrl(Deno.mainModule));
	return path.join(mainDir, p);
}
