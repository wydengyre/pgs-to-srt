// Copyright (C) 2022 Wyden and Gyre, LLC
import { runConvert } from "./convert.ts";
import { Buffer } from "std/io/buffer.ts";
import { assertEquals, assertMatch } from "std/testing/asserts.ts";
import { getTestPath } from "../test/path.ts";

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

async function testConversion(
  lang: string,
  inSupFileName: string,
  outSrtFileName: string,
  stdErrRegex?: RegExp,
) {
  const trainedDataPath = getTestPath(lang);
  const inSupPath = getTestPath(inSupFileName);
  const outSrtPath = getTestPath(outSrtFileName);
  const [inSup, outSrt] = await Promise.all([
    Deno.readFile(inSupPath),
    Deno.readFile(outSrtPath),
  ]);

  const outBuffer = new Buffer();
  const errBuffer = new Buffer();
  await runConvert(inSup, trainedDataPath, outBuffer, errBuffer);
  const outBytes = outBuffer.bytes({ copy: false });

  assertEquals(outBytes, outSrt);

  const td = new TextDecoder();
  const stdErrStr = td.decode(errBuffer.bytes({ copy: false }));

  if (stdErrRegex !== undefined) {
    assertMatch(stdErrStr, stdErrRegex);
  }
}
