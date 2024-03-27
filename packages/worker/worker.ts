// Copyright (C) 2023 Wyden and Gyre, LLC

import { expose, proxy } from "comlink";
import { createOCREngine } from "../../deps/tesseract-wasm/lib.js";
import {
	type PacketOds,
	expand,
	imageToLittleEndian,
	render,
} from "./render.js";

export type { InitFn, RecognizeFn };

expose(init);

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

type InitFn = (trainedData: Uint8Array, wasmBinary: Uint8Array) => Promise<{ recognize: RecognizeFn; }>;
type RecognizeFn = ({
	pds,
	ods,
}: { pds: Uint32Array; ods: PacketOds }) => string;

async function init(trainedData: Uint8Array, wasmBinary: Uint8Array): Promise<{ recognize: typeof recognize }> {
	const emscriptenModuleOptions = { print: logToStdout, printErr: logToStderr };
	const engine = await createOCREngine({
		emscriptenModuleOptions,
		progressChannel: undefined,
		wasmBinary,
	});
	engine.loadModel(trainedData);

	function recognize({
		pds,
		ods,
	}: { pds: Uint32Array; ods: PacketOds }): string {
		const rendered = render(ods, pds);
		const expanded = expand(rendered);
		const { width, height } = expanded;
		const data = imageToLittleEndian(expanded);

		const imageData = { width, height, data };
		engine.loadImage(imageData);
		engine.setVariable("tessedit_pageseg_mode", PSM_SINGLE_BLOCK.toString());
		engine.setVariable("user_defined_dpi", DPI.toString());
		return engine.getText();
	}
	return { recognize: proxy(recognize) };
}
