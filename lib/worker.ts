// Copyright (C) 2022 Wyden and Gyre, LLC
/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { createOCREngine } from "../deps/tesseract-wasm/lib.js";
import { PacketOds } from "./transform.ts";
import { expand, imageToLittleEndian, render } from "./render.ts";

const DPI = 120;
const PSM_SINGLE_BLOCK = 6;

const stdout: string[] = [];
const stderr: string[] = [];

const logToFakeStream = (fakeStream: string[], msg: string): void => {
  fakeStream.push(msg);
};

const logToStdout = (msg: string): void => {
  logToFakeStream(stdout, msg);
};

const logToStderr = (msg: string): void => {
  logToFakeStream(stderr, msg);
};

self.onmessage = async (e: MessageEvent) => {
  let initPromise: Promise<void>;
  self.onmessage = async (e: MessageEvent) => {
    await initPromise;
    recognize(e.data);
  };
  initPromise = init(e.data);
  await initPromise;
  postMessage(null);
};

let engine: Awaited<ReturnType<typeof createOCREngine>>;
async function init(
  { trainedData, wasmBinary }: {
    trainedData: Uint8Array;
    wasmBinary: Uint8Array;
  },
): Promise<void> {
  const emscriptenModuleOptions = { print: logToStdout, printErr: logToStderr };
  engine = await createOCREngine({
    emscriptenModuleOptions,
    progressChannel: undefined,
    wasmBinary,
  });
  engine.loadModel(trainedData);
}

function recognize({ pds, ods }: { pds: Uint32Array; ods: PacketOds }) {
  const rendered = render(ods, pds);
  const expanded = expand(rendered);
  const { width, height } = expanded;
  const data = imageToLittleEndian(expanded);

  // actually typing this with ImageData causes weird explosions
  const imageData = { width, height, data };
  engine.loadImage(imageData);
  engine.setVariable("tessedit_pageseg_mode", PSM_SINGLE_BLOCK.toString());
  engine.setVariable("user_defined_dpi", DPI.toString());
  const text = engine.getText();
  postMessage(text);
}
