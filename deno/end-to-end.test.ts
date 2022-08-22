// Copyright (C) 2022 Wyden and Gyre, LLC
import * as path from "std/path/mod.ts";
import { assertEquals, assertStrictEquals } from "std/testing/asserts.ts";
import { getTestPath } from "../test/path.ts";

const mainPath = import.meta.resolve("./pgs-to-srt.ts");

Deno.test("install and test core functionality", async (t) => {
  const execPath = Deno.execPath();
  const tempDir = await Deno.makeTempDir();
  const td = new TextDecoder();

  await t.step("install", async () => {
    const { code, stderr } = await Deno.spawn(execPath, {
      args: ["install", "--allow-read", "--root", tempDir, mainPath],
    });
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);
  });

  const installedPath = path.resolve(tempDir, "bin/pgs-to-srt");

  await t.step("convert", async () => {
    const trainedDataPath = getTestPath("eng.fast.traineddata");
    const inSupPath = getTestPath("lostillusions.first100.en.sup");
    const expectedSrtPath = getTestPath("lostillusions.en.fast.expected.srt");

    const expectedSrt = await Deno.readFile(expectedSrtPath);

    const { code, stdout, stderr } = await Deno.spawn(installedPath, {
      args: [trainedDataPath, inSupPath],
    });
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);

    assertEquals(stdout, expectedSrt);
  });

  await t.step("extract image", async () => {
    const IMAGE_INDEX = 2;
    const inSupPath = getTestPath("lostillusions.first100.fr.sup");
    const outBmpPath = getTestPath("lostillusions.fr.sub2.bmp");

    const outBmp = await Deno.readFile(outBmpPath);

    const { code, stdout, stderr } = await Deno.spawn(installedPath, {
      args: [IMAGE_INDEX.toString(10), inSupPath],
    });
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);
    assertEquals(stdout, outBmp);
  });
});
