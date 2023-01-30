import { configPath, configVal } from "./conf.ts";
import * as path from "std/path/mod.ts";
import { expandGlob } from "std/fs/expand_glob.ts";
import { denoPlugin } from "esbuild_plugin_deno_loader";
import * as esbuild from "esbuild";

const IMPORT_MAP_PATH_REL = "../import_map.json";
const importMapURL = new URL(import.meta.resolve(IMPORT_MAP_PATH_REL));

const INDIVIDUAL_FILES_TO_COPY = [
  "./index.html",
  "./pico.classless.min.css",
  "./pico.classless.min.css.map",
  "./favicon.ico",
  "../deps/tesseract-wasm/tesseract-core.wasm",
  "../deps/tesseract-wasm/tesseract-core-fallback.wasm",
];

async function main() {
  const distDir = configPath("distDir");
  await Deno.mkdir(distDir, { recursive: true });

  // copy individual files
  const copyPromises = INDIVIDUAL_FILES_TO_COPY.map((rel) => {
    const src = path.fromFileUrl(import.meta.resolve(rel));
    const filename = path.basename(rel);
    const dest = path.join(distDir, filename);
    return Deno.copyFile(src, dest);
  });
  await Promise.all(copyPromises);

  // copy pngs
  const thisDirPath = path.fromFileUrl(import.meta.resolve("./"));
  const pngGlob = path.join(thisDirPath, "*.png");
  await copyGlob(pngGlob, distDir);

  // copy trained data
  const trainedDataPath = path.fromFileUrl(
    import.meta.resolve("../tessdata_fast"),
  );
  const trainedDataGlob = path.join(trainedDataPath, "*.traineddata");
  await copyGlob(trainedDataGlob, distDir);

  // compile main
  const mainPath = configPath("main");
  const mainDistPath = path.join(distDir, configVal("distMainFile"));
  await bundleTs(mainPath, mainDistPath, "esm");

  // compile worker
  const workerPath = configPath("worker");
  const workerDistPath = path.join(distDir, configVal("distWorkerFile"));
  await bundleTs(workerPath, workerDistPath, "iife");

  // nasty hack to fix up worker
  // TODO: use a setting upstream to avoid generating this
  // https://github.com/haberbyte/emscripten/commit/855b65fc8be5fea7e8878299cea61b670b61bfa6
  const workerDistText = await Deno.readTextFile(workerDistPath);
  const workerDistTextFixed = workerDistText.replaceAll(
    "import_meta.url",
    "location.href",
  );
  await Deno.writeTextFile(workerDistPath, workerDistTextFixed);
}

async function copyGlob(pathGlob: string, destDirPath: string) {
  const filePaths = expandGlob(pathGlob);
  for await (const filePath of filePaths) {
    const dest = path.join(destDirPath, filePath.name);
    await Deno.copyFile(filePath.path, dest);
  }
}

export async function bundleTs(
  sourcePath: string,
  outfile: string,
  format: "esm" | "iife",
) {
  await esbuild.build({
    bundle: true,
    entryPoints: [sourcePath],
    format: format,
    minify: false,
    outfile,
    plugins: [denoPlugin({ importMapURL })],
    sourcemap: true,
  });
  esbuild.stop();
}

if (import.meta.main) {
  await main();
}
