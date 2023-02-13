import * as path from "std/path/mod.ts";
import { configPath, configVal } from "./build-config.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.17.7/mod.js";

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
    args: ["bundle", inPath],
    cwd: path.fromFileUrl(import.meta.resolve("../")),
  });
  const { success, code, stdout, stderr } = await cmd.output();
  if (!success) {
    const err = new TextDecoder().decode(stderr);
    throw `bundling file ${inPath} to ${outPath} failed with code ${code}: ${err}`;
  }

  const outText = new TextDecoder().decode(stdout);
  const cleanedImportMeta = cleanImportMeta(outText);

  const buildOptions: esbuild.TransformOptions = {
    treeShaking: true,
  };
  const build = await esbuild.transform(cleanedImportMeta, buildOptions);
  esbuild.stop();
  if (build.warnings.length > 0) {
    throw `Warnings from esbuild: ${build.warnings}`;
  }

  await Deno.writeTextFile(outPath, build.code);
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

// The Deno bundler unnecessarily adds an importMeta.url property that leaks details about the build path
// Sadly, we still need importMeta.url because emscripten uses import.meta.url to construct a URL
// that ultimately doesn't get used, so we need to swap in a dummy value.
function cleanImportMeta(bundledCode: string): string {
  const importMetaUrlRegex = /^(const importMeta = {\n\s*url:)(.+)(,)$/m;
  const found = importMetaUrlRegex.test(bundledCode);
  if (!found) {
    throw "Failed to find importMeta.url";
  }

  return bundledCode.replace(importMetaUrlRegex, '$1"file://"$3');
}

if (import.meta.main) {
  await main();
}
