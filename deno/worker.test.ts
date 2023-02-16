import { toFileUrl } from "std/path/mod.ts";
import { workerBundlePath } from "./build.ts";
import { deferred } from "std/async/deferred.ts";
import { deadline } from "std/async/deadline.ts";
import { assertStrictEquals } from "std/testing/asserts.ts";

Deno.test("worker.js reports back init errors", async () => {
  const workerUrl = toFileUrl(workerBundlePath);

  const d = deferred<ErrorEvent>();
  const w = new Worker(workerUrl, { type: "module" });
  w.onerror = (e: ErrorEvent) => {
    e.preventDefault();
    d.resolve(e);
    w.terminate();
  };

  // by posting empty binary and trainedData, we should get an error
  const trainedData = new Uint8Array();
  const wasmBinary = new Uint8Array();
  w.postMessage({ trainedData, wasmBinary });

  const TIMEOUT_MS = 50; // might need to adjust if ci is too slow
  const err: ErrorEvent = await deadline(d, TIMEOUT_MS);

  const expectedFilename = workerUrl.toString();
  assertStrictEquals(err.filename, expectedFilename);

  const expectedMessage =
    "Uncaught RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): BufferSource argument is empty). Build with -sASSERTIONS for more info.";
  assertStrictEquals(err.message, expectedMessage);
});
