// Copyright (C) 2024 Wyden and Gyre, LLC
import * as path from "std/path/mod.ts";
import { assertEquals, assertStrictEquals } from "std/testing/asserts.ts";
import { getTestPath } from "../packages/cli/test-path.ts";
import { configPath, configVal } from "../packages/cli/build-config.ts";
import { run } from "../packages/cli/build-util.ts";

/**
 * Project must be built before running.
 */

const bundleZipPath = configPath("bundleZip");
const importMapPath = import.meta.resolve("../import_map.json");
const installedBinName = "pgs-to-srt";

Deno.test("install and test core functionality", async (t) => {
  const execPath = Deno.execPath();
  const tempUnzipDir = await Deno.makeTempDir();
  const tempInstallDir = await Deno.makeTempDir();
  const td = new TextDecoder();

  await t.step("install", async () => {
    await run("unzip", "-d", tempUnzipDir, bundleZipPath);
    const zipDirName = path.basename(bundleZipPath, ".zip");
    const unzippedMainPath = path.join(
      tempUnzipDir,
      zipDirName,
      configVal("mainBundle"),
    );
    await run(
      execPath,
      "install",
      "--allow-read",
      "--import-map",
      importMapPath,
      "--root",
      tempInstallDir,
      "--name",
      installedBinName,
      unzippedMainPath,
    );
  });

  const installedPath = path.resolve(tempInstallDir, `bin/${installedBinName}`);

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
