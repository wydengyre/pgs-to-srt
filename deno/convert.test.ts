// Copyright (C) 2023 Wyden and Gyre, LLC
import { runConvert } from "./convert.ts";
import { Buffer } from "std/io/buffer.ts";
import { assertEquals, assertMatch } from "std/testing/asserts.ts";
import { getTestPath } from "./test-path.ts";
import env from "./conf.dev.json" assert { type: "json" };
import { fromFileUrl } from "std/path/mod.ts";

Deno.test("convert lostillusions.first100.en.sup", () => {
  return testConversion(
    "eng.fast.traineddata",
    "lostillusions.first100.en.sup",
    "lostillusions.en.fast.expected.srt",
  );
});

Deno.test("convert lostillusions.first100.fr.sup", () => {
  return testConversion(
    "fra.fast.traineddata",
    "lostillusions.first100.fr.sup",
    "lostillusions.fr.fast.expected.srt",
    /12 blank subtitles at indices 1, 3, 4, 8, 9, 16, 20, 39, 45, 47, 91, 93\n$/,
  );
});

Deno.test("convert 04e07.sup", () => {
  return testConversion(
    // it's in German, but we just want to test that conversion doesn't crash
    "eng.fast.traineddata",
    "04e07.sup",
    null,
    /7 blank subtitles at indices 92, 109, 112, 305, 337, 341, 364\n$/,
  );
});

async function testConversion(
  lang: string,
  inSupFileName: string,
  outSrtFileName: string | null,
  stdErrRegex?: RegExp,
) {
  const trainedDataPath = getTestPath(lang);
  const inSupPath = getTestPath(inSupFileName);
  const inSup = await Deno.readFile(inSupPath);

  let outSrt: Uint8Array | null = null;
  if (outSrtFileName !== null) {
    const outSrtPath = getTestPath(outSrtFileName);
    outSrt = await Deno.readFile(outSrtPath);
  }

  const outBuffer = new Buffer();
  const errBuffer = new Buffer();
  await runConvert(inSup, {
    trainedDataPath,
    wasmPath: fromFileUrl(import.meta.resolve(env.wasmPath)),
    workerPath: fromFileUrl(import.meta.resolve(env.workerPath)),
    outWriter: outBuffer,
    errWriter: errBuffer,
  });
  if (outSrt !== null) {
    const outBytes = outBuffer.bytes({ copy: false });
    assertEquals(outBytes, outSrt);
  }

  const td = new TextDecoder();
  const stdErrStr = td.decode(errBuffer.bytes({ copy: false }));

  if (stdErrRegex !== undefined) {
    assertMatch(stdErrStr, stdErrRegex);
  }
}
