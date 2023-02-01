import { pipeline } from "../lib/pipeline.ts";
import { supportsFastBuild } from "../deps/tesseract-wasm/lib.js";
export { pathFilename, pipeline, renderInitial, supportsFastBuild };
declare function renderInitial(
  pgs: Uint8Array,
): AsyncGenerator<HTMLCanvasElement>;
declare function pathFilename(p: string): string;
