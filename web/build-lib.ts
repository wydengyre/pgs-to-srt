import { denoPlugins } from "esbuild_plugin_deno_loader";
import * as esbuild from "esbuild";
import { configPath, configVal } from "./build-conf.ts";
import * as path from "std/path/mod.ts";
import { fromFileUrl } from "std/path/mod.ts";
import * as dnt from "dnt";

export { workerBuildPath };

const IMPORT_MAP_PATH_REL = "../import_map.json";
const importMapPath = import.meta.resolve(IMPORT_MAP_PATH_REL);

// the shim is needed for the worker to work sa non-module (IIFE), which is needed for Firefox
const urlShimPath = fromFileUrl(
  import.meta.resolve("./import-meta-url-shim.js"),
);

const buildDir = configPath("buildDir");
const workerPath = configPath("worker");
const workerBuildPath = path.join(buildDir, configVal("outWorkerFile"));

async function main() {
  // compile lib
  const libPath = configPath("lib");
  const buildNodePackageDir = configPath("buildNodePackageDir");
  await dnt.build({
    compilerOptions: {
      lib: ["DOM", "ESNext"],
    },
    entryPoints: [libPath],
    importMap: importMapPath,
    outDir: buildNodePackageDir,
    shims: {
      deno: false,
    },
    package: {
      name: "pgs-to-srt-web-lib",
      version: "0.0.1",
    },
    // this typecheck will be performed when we compile main.ts,
    // because we include the "canonical" TS directly
    typeCheck: false,
    test: false,
    // ideally we wouldn't output esm either, as we only want the canonical typescript output
    scriptModule: false,
  });

  // compile worker
  await bundleDenoTs(workerPath, workerBuildPath, "iife");
}

export async function bundleDenoTs(
  sourcePath: string,
  outfile: string,
  format: "esm" | "iife",
) {
  const buildOptions: esbuild.BuildOptions = {
    bundle: true,
    entryPoints: [sourcePath],
    format: format,
    minify: true,
    outfile,
    plugins: denoPlugins(),
    sourcemap: true,
  };
  if (format === "iife") {
    buildOptions.inject = [urlShimPath];
  }
  await esbuild.build(buildOptions);
  esbuild.stop();
}

if (import.meta.main) {
  await main();
}
