// Copyright (C) 2023 Wyden and Gyre, LLC
import { assertStrictEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { assertEquals } from "std/testing/asserts.ts";
import { getTestPath } from "./test-path.ts";

const execPath = Deno.execPath();

const runPath = import.meta.resolve("./main.ts");

Deno.test("fast convert lostillusions.first100.en.sup", () => {
  const inSupFileName = "lostillusions.first100.en.sup";
  const outSrtFileName = "lostillusions.en.fast.expected.srt";
  const engTrainedDataPath = "eng.fast.traineddata";
  return testConvert(engTrainedDataPath, inSupFileName, outSrtFileName);
});

Deno.test("fast convert lostillusions.first100.fr.sup using stdin", () => {
  const inSupFileName = "lostillusions.first100.fr.sup";
  const outSrtFileName = "lostillusions.fr.fast.expected.srt";
  const fraTrainedDataPath = "fra.fast.traineddata";
  return testConvert(fraTrainedDataPath, inSupFileName, outSrtFileName, true);
});

Deno.test("bmp image extraction", async () => {
  const IMAGE_INDEX = 2; // somewhat arbitrary

  const inSupPath = getTestPath("lostillusions.first100.fr.sup");
  const outBmpPath = getTestPath("lostillusions.fr.sub2.bmp");

  const outBmp = await Deno.readFile(outBmpPath);

  const p = new Deno.Command(execPath, {
    args: [
      "run",
      "--allow-read",
      runPath,
      IMAGE_INDEX.toString(10),
      inSupPath,
    ],
    stderr: "inherit",
    stdout: "piped",
  });
  const { code, stdout } = await p.output();

  assertStrictEquals(code, 0);
  assertEquals(stdout, outBmp);
});

async function testConvert(
  trainedDataFilename: string,
  inSupFileName: string,
  outSrtFileName: string,
  useStdin = false,
) {
  const trainedDataPath = getTestPath(trainedDataFilename);
  const inSupPath = getTestPath(inSupFileName);
  const expectedSrtPath = getTestPath(outSrtFileName);

  const expectedSrt = await Deno.readFile(expectedSrtPath);

  const start = performance.now();
  const p = new Deno.Command(execPath, {
    args: [
      "run",
      "--allow-read",
      runPath,
      trainedDataPath,
      useStdin ? "-" : inSupPath,
    ],
    stderr: "inherit",
    stdout: "piped",
    stdin: useStdin ? "piped" : undefined,
  }).spawn();

  if (useStdin) {
    const inSup = await Deno.readFile(inSupPath);
    new Blob([inSup]).stream().pipeTo(p.stdin).then();
  }
  const { code, stdout } = await p.output();
  const end = performance.now();
  console.log(`\nran test in ${end - start}`);

  assertStrictEquals(code, 0);
  assertEquals(stdout, expectedSrt);
}
