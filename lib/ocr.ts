// Copyright (C) 2023 Wyden and Gyre, LLC
import { tee } from "std/async/mod.ts";
import { Pool } from "./async.ts";
import { Unrendered } from "./transform.ts";

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
  unrendered: AsyncIterable<Unrendered>,
): AsyncIterableIterator<Subtitle> {
  const [unrendered1, unrendered2] = tee(unrendered);
  const iter = unrendered2[Symbol.asyncIterator]();

  const pool = await Pool.create<Unrendered, string>(
    workerSpecifier,
    { wasmBinary, trainedData },
  );

  try {
    for await (const text of pool.process(unrendered1)) {
      let { startTime, endTime } = (await iter.next()).value;
      startTime /= TIME_ACCURACY_KHZ;
      endTime /= TIME_ACCURACY_KHZ;
      yield { startTime, endTime, text };
    }
  } finally {
    pool.kill();
  }
}
