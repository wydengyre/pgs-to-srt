// Copyright (C) 2024 Wyden and Gyre, LLC
import { parse } from "./parse.ts";
import { iterOds, packetize, pgsSchema } from "./transform.ts";
import { tee } from "jsr:@std/async@^1.0.10";
import { ocr } from "./ocr.ts";
import { srt } from "./srt.ts";

export type Progress = {
  completed: number;
  total: number;
};

export async function* pipeline(
  pgs: Uint8Array,
  workerURL: URL,
  wasmBinary: Uint8Array,
  trainedData: Uint8Array,
  outlineFlag: string,
): AsyncGenerator<[Progress, string], number[]> {
  const result = parse(pgs);
  const basicParsed = pgsSchema.parse(result);
  const parsedSegments = basicParsed.segment;
  const groupedSegments = packetize(parsedSegments, outlineFlag);
  const unrendered = iterOds(groupedSegments);
  const [toBeRendered, toCount] = tee(unrendered, 2);
  let total = 0;
  for await (const _ of toCount) {
    total++;
  }
  const ocrd = ocr(workerURL, wasmBinary, trainedData, toBeRendered, outlineFlag);
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

