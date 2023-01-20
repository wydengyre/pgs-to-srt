// Copyright (C) 2023 Wyden and Gyre, LLC
import { pipeline } from "../lib/pipeline.ts";
import { writeAll } from "std/streams/conversion.ts";
import { render } from "./progress.ts";
import { fromFileUrl } from "std/path/mod.ts";

const WASM_PATH = fromFileUrl(
  import.meta.resolve("../deps/tesseract-wasm/tesseract-core.wasm"),
);
const WORKER_PATH = fromFileUrl(import.meta.resolve("../lib/worker.ts"));
const WORKER_URL = new URL(WORKER_PATH, import.meta.url);

export async function runConvert(
  sup: Uint8Array,
  trainedDataPath: string,
  outWriter: Deno.Writer,
  errWriter: Deno.Writer,
): Promise<void> {
  const [wasmBinary, trainedData] = await Promise.all([
    Deno.readFile(WASM_PATH),
    Deno.readFile(trainedDataPath),
  ]);
  return runWithData(sup, wasmBinary, trainedData, outWriter, errWriter);
}

async function runWithData(
  sup: Uint8Array,
  wasmBinary: Uint8Array,
  trainedData: Uint8Array,
  outWriter: Deno.Writer,
  errWriter: Deno.Writer,
): Promise<void> {
  const srtIter = pipeline(sup, WORKER_URL, wasmBinary, trainedData);
  const te = new TextEncoder();
  let next = await srtIter.next();
  while (!next.done) {
    const [{ completed, total }, sub] = next.value;
    const bytes = te.encode(`${sub}\n`);
    await writeAll(outWriter, bytes);
    await render(errWriter, { completed, total });
    next = await srtIter.next();
  }

  const blanks = next.value;
  const blankCount = blanks.length;
  if (blankCount > 0) {
    const warnStr = blankCount > 1
      ? `\n${blankCount} blank subtitles at indices ${blanks.join(", ")}`
      : `\n one blank subtitle at index ${blanks[0]}`;
    const bytes = te.encode(`${warnStr}\n`);
    await writeAll(errWriter, bytes);
  }
}
