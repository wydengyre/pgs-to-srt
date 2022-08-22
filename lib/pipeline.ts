// Copyright (C) 2022 Wyden and Gyre, LLC
import { parse } from "./parse.ts";
import { iterOds, packetize, pgsSchema } from "./transform.ts";
import { tee } from "std/async/tee.ts";
import { ocr } from "./ocr.ts";
import { srt } from "./srt.ts";
import { Progress } from "../deno/progress.ts";

export async function* pipeline(
  pgs: Uint8Array,
  workerURL: URL,
  wasmBinary: Uint8Array,
  trainedData: Uint8Array,
): AsyncGenerator<[Progress, string], number[]> {
  const result = parse(pgs);
  const basicParsed = pgsSchema.parse(result);
  const parsedSegments = basicParsed.segment;
  const groupedSegments = packetize(parsedSegments);
  const unrendered = iterOds(groupedSegments);
  const [toBeRendered, toCount] = tee(unrendered, 2);
  let total = 0;
  for await (const _ of toCount) {
    total++;
  }
  const ocrd = ocr(workerURL, wasmBinary, trainedData, toBeRendered);
  const srtIter = srt(ocrd);
  let next = await srtIter.next();
  let completed = 0;
  while (!next.done) {
    completed++;
    yield [{ completed, total }, next.value];
    next = await srtIter.next();
  }
  return next.value;
}
