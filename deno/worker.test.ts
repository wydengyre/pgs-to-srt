import { toFileUrl } from "std/path/mod.ts";
import { workerBundlePath } from "./build.ts";
import { deadline } from "std/async/deadline.ts";
import { assertStrictEquals } from "std/testing/asserts.ts";

Deno.test("worker.js reports back init errors", async () => {
  const workerUrl = toFileUrl(workerBundlePath);

  // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
  // TODO: at the time of writing, Safari does not support Promise.withResolvers. When it does, replace this.
  let resolve: (value: ErrorEvent | PromiseLike<ErrorEvent>) => void;
  const p = new Promise<ErrorEvent>((res) => {
    resolve = res;
  });

  const w = new Worker(workerUrl, { type: "module" });
  w.onerror = (e: ErrorEvent) => {
    e.preventDefault();
    resolve(e);
    w.terminate();
  };

  // by posting empty binary and trainedData, we should get an error
  const trainedData = new Uint8Array();
  const wasmBinary = new Uint8Array();
  w.postMessage({ trainedData, wasmBinary });

  const TIMEOUT_MS = 100; // might need to adjust if ci is too slow
  const err: ErrorEvent = await deadline(p, TIMEOUT_MS);

  const expectedFilename = workerUrl.toString();
  assertStrictEquals(err.filename, expectedFilename);

  const expectedMessage =
    "Uncaught RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): BufferSource argument is empty). Build with -sASSERTIONS for more info.";
  assertStrictEquals(err.message, expectedMessage);
});
