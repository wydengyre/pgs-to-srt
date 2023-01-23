// Copyright (C) 2023 Wyden and Gyre, LLC
import * as path from "std/path/mod.ts";
import { assertEquals, assertStrictEquals } from "std/testing/asserts.ts";
import { getTestPath } from "../deno/test-path.ts";

const mainPath = import.meta.resolve("../deno/main.ts");
const importMapPath = import.meta.resolve("../import_map.json");
const installedBinName = "pgs-to-srt";
Deno.test("install and test core functionality", async (t) => {
  const execPath = Deno.execPath();
  const tempDir = await Deno.makeTempDir();
  const td = new TextDecoder();

  await t.step("install", async () => {
    const { code, stderr } = await new Deno.Command(execPath, {
      args: [
        "install",
        "--allow-read",
        "--import-map",
        importMapPath,
        "--root",
        tempDir,
        "--name",
        installedBinName,
        mainPath,
      ],
    }).output();
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);
  });

  const installedPath = path.resolve(tempDir, `bin/${installedBinName}`);

  await t.step("convert", async () => {
    const trainedDataPath = getTestPath("eng.fast.traineddata");
    const inSupPath = getTestPath("lostillusions.first100.en.sup");
    const expectedSrtPath = getTestPath("lostillusions.en.fast.expected.srt");

    const expectedSrt = await Deno.readFile(expectedSrtPath);

    const { code, stdout, stderr } = await new Deno.Command(installedPath, {
      args: [trainedDataPath, inSupPath],
    }).output();
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);

    assertEquals(stdout, expectedSrt);
  });

  await t.step("extract image", async () => {
    const IMAGE_INDEX = 2;
    const inSupPath = getTestPath("lostillusions.first100.fr.sup");
    const outBmpPath = getTestPath("lostillusions.fr.sub2.bmp");

    const outBmp = await Deno.readFile(outBmpPath);

    const { code, stdout, stderr } = await new Deno.Command(installedPath, {
      args: [IMAGE_INDEX.toString(10), inSupPath],
    }).output();
    const err = td.decode(stderr);
    assertStrictEquals(code, 0, err);
    assertEquals(stdout, outBmp);
  });
});
