import { configPath, configVal } from "./build-conf.ts";
import * as path from "std/path/mod.ts";
import { expandGlob } from "std/fs/expand_glob.ts";
import * as esbuild from "esbuild";
import { workerBuildPath } from "./build-lib.ts";

const INDIVIDUAL_FILES_TO_COPY = [
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

  // copy worker
  const workerDistPath = path.join(distDir, configVal("outWorkerFile"));
  await Deno.copyFile(workerBuildPath, workerDistPath);
  const workedMapBuildPath = workerBuildPath + ".map";
  const workerMapDistPath = workerDistPath + ".map";
  await Deno.copyFile(workedMapBuildPath, workerMapDistPath);

  // render index template
  const CANONICAL_HOME_VAR = "$CANONICAL_HOME";
  const canonicalHome = configVal("canonicalHome");
  const indexTemplatePath = configPath("indexTemplate");
  const indexTemplateText = await Deno.readTextFile(indexTemplatePath);
  const indexText = indexTemplateText.replaceAll(
    CANONICAL_HOME_VAR,
    canonicalHome,
  );
  const indexPath = path.join(distDir, "index.html");
  await Deno.writeTextFile(indexPath, indexText);

  // bundle main.ts
  const mainPath = configPath("main");
  const outMainFile = configVal("outMainFile");
  const outfile = path.join(distDir, outMainFile);
  const buildOptions = {
    bundle: true,
    entryPoints: [mainPath],
    format: "esm",
    minify: true,
    outfile,
    sourcemap: true,
  };
  await esbuild.build(buildOptions);
  esbuild.stop();
}

async function copyGlob(pathGlob: string, destDirPath: string) {
  const filePaths = expandGlob(pathGlob);
  for await (const filePath of filePaths) {
    const dest = path.join(destDirPath, filePath.name);
    await Deno.copyFile(filePath.path, dest);
  }
}

if (import.meta.main) {
  await main();
}
