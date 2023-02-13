// Copyright (C) 2023 Wyden and Gyre, LLC
/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { createOCREngine } from "../deps/tesseract-wasm/lib.js";
import { PacketOds } from "./transform.ts";
import { expand, imageToLittleEndian, render } from "./render.ts";

const DPI = 120;
const PSM_SINGLE_BLOCK = 6;

const stdout: string[] = [];
const stderr: string[] = [];

const uuid = crypto.randomUUID();
console.log(`worker thread spinning up: ${uuid}`);

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
  console.log(`${uuid}: worker thread: got init message`);
  let initPromise: Promise<void>;
  self.onmessage = async (e: MessageEvent) => {
    await initPromise;
    recognize(e.data);
  };
  console.log(`${uuid}: worker thread:init with data`);
  initPromise = init(e.data);
  await initPromise;
  console.log(`${uuid} worker thread: posting message home`);
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
  console.log(`${Date.now()} ${uuid}: creating OCR engine`);
  console.log(`${uuid}: wasmBinary size: ${wasmBinary.length}`);
  console.log(`${uuid}: trainedData size: ${trainedData.length}`);
  engine = await createOCREngine({
    emscriptenModuleOptions,
    progressChannel: undefined,
    wasmBinary,
  });
  console.log(`${Date.now()} ${uuid}: loading training data`);
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
