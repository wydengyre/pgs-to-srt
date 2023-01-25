import * as path from "std/path/mod.ts";
import { configPath, configVal } from "./build-config.ts";

const mainPath = configPath("main");
const workerPath = configPath("worker");
const tesseractWasmPath = configPath("tesseractWasm");

const bundleDistDir = configPath("bundleDistDir");
const mainBundlePath = path.join(bundleDistDir, configVal("mainBundle"));
const workerBundlePath = path.join(bundleDistDir, configVal("workerBundle"));
const tesseractWasmBundlePath = path.join(
  bundleDistDir,
  configVal("tesseractWasmBundle"),
);
const bundleZipPath = configPath("bundleZip");
const bundleZipDirPath = path.dirname(bundleZipPath);

async function main() {
  await Deno.mkdir(bundleDistDir, { recursive: true });
  await denoBundle(mainPath, mainBundlePath);
  await denoBundle(workerPath, workerBundlePath);
  await Deno.copyFile(tesseractWasmPath, tesseractWasmBundlePath);

  await Deno.mkdir(bundleZipDirPath, { recursive: true });
  const bundleParentDir = path.dirname(bundleDistDir);
  await zip(bundleParentDir, bundleDistDir, configPath("bundleZip"));
}

// TODO: consider a timeout using an abort signal
async function denoBundle(inPath: string, outPath: string) {
  const cmd = new Deno.Command("deno", {
    args: ["bundle", inPath, outPath],
    cwd: path.fromFileUrl(import.meta.resolve("../")),
  });
  const child = cmd.spawn();
  const { success, code } = await child.status;
  if (!success) {
    throw `bundling file ${inPath} to ${outPath} failed with code ${code}`;
  }
}

// TODO: consider a timeout using an abort signal
async function zip(fromPath: string, inPath: string, outPath: string) {
  const relativeInPath = path.relative(fromPath, inPath);
  const cmd = new Deno.Command("zip", {
    args: [
      "-q", // quiet
      "-r", // recurse into subdirs
      outPath,
      relativeInPath,
    ],
    cwd: fromPath,
  });
  const child = cmd.spawn();
  const { success, code } = await child.status;
  if (!success) {
    throw `zipping ${inPath} to ${outPath} failed with code ${code}`;
  }
}

if (import.meta.main) {
  await main();
}
