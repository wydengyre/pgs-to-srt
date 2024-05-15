// Copyright (C) 2024 Wyden and Gyre, LLC
import * as Sentry from "@sentry/browser";

// by importing from the "canonical" TS, we don't need to play with
// npm link, or performing npm install every time we update the source,
// we simply need to run the lib build
import {
  pathFilename,
  pipeline,
  renderInitial,
  supportsFastBuild,
} from "../build/web/node_package/src/web/lib.js";

// TODO: get this value from config. Right now it breaks esbuild with
// The file "conf.json" was loaded with the "js" loader
const WORKER_URL = new URL("worker.js", window.location.href);

const SCROLL_INTO_VIEW_OPTIONS: ScrollIntoViewOptions = {
  behavior: "smooth",
  block: "start",
  inline: "nearest",
};

// TODO: show progress
type LoadingBinary = Promise<Uint8Array>;

// TODO: add the worker script itself, which should be precached
type State = {
  // prelude: begin loading tesseract wasm
  tesseractWasmPromise: LoadingBinary;

  // step 1 select file
  sup: {
    supFile: File;
    supContent: Promise<ArrayBuffer>;
  } | null;

  // step 2: select trained data
  trainedData: Map<string, LoadingBinary>;

  // step 3: srt
  srt: {
    text: string;
    progress: number;
    blanks: number[];
  } | null;
};

const wasmPathRel = supportsFastBuild()
  ? "tesseract-core.wasm"
  : "tesseract-core-fallback.wasm";
const wasmUrl = new URL(wasmPathRel, window.location.href);

const state: State = {
  /*
   * Data to fetch
   */
  tesseractWasmPromise: fetchBin(wasmUrl),
  trainedData: new Map(),
  sup: null,
  srt: null,
};

// init Sentry error handling
Sentry.init({
  dsn:
    "https://c5baaa1f5c48474892630d9d01cb18cd@o1384843.ingest.sentry.io/6703724",

  // Alternatively, use `process.env.npm_package_version` for a dynamic release version
  // if your build tool supports it.
  release: "pgs-to-srt-noversion",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadDom);
} else {
  loadDom();
}

// load these when DOM is ready
let fileInput: HTMLInputElement;
let languageDiv: HTMLDivElement;
let langSelect: HTMLSelectElement;
let progress: HTMLProgressElement;
let canvasses: HTMLCanvasElement;
let conversionDiv: HTMLDivElement;
let warning: HTMLParagraphElement;
let textarea: HTMLTextAreaElement;
let saveButton: HTMLButtonElement;

function loadDom() {
  fileInput = document.querySelector('input[type="file"]')!;
  languageDiv = document.querySelector("#language")!;
  langSelect = document.querySelector("select")!;
  progress = document.querySelector("progress")!;
  canvasses = document.querySelector("#canvasses")!;
  conversionDiv = document.querySelector("#conversion")!;
  warning = document.querySelector("#blank-subtitle-warning")!;
  textarea = document.querySelector("textarea")!;
  saveButton = document.querySelector("#savesrt")!;

  fileInput.addEventListener("change", pickFile);
  langSelect.addEventListener("change", selectLanguage);
  saveButton.addEventListener("click", saveSrt);
}

function setPercentComplete(pct: number) {
  state.srt!.progress = pct;
  progress.value = pct;
}

function addSub(sub: string) {
  const addedText = `${sub}\n`;
  state.srt!.text += addedText;
  textarea.value += addedText;
  textarea.scrollTop = textarea.scrollHeight;
}

async function pickFile(this: HTMLInputElement) {
  languageDiv.scrollIntoView(SCROLL_INTO_VIEW_OPTIONS);

  const supFile = this.files!.item(0)!;

  Sentry.addBreadcrumb({
    level: "info",
    category: "ui",
    message: `selected SUP file: ${supFile.name}`,
  });

  gtag("event", "pick_file", { file_name: supFile.name });

  const supContent = supFile.arrayBuffer();
  state.sup = { supFile, supContent };

  const pgs = new Uint8Array(await supContent);
  const renderedCanvasses = renderInitial(pgs);

  const INITIAL_IMAGES_TO_RENDER_COUNT = 5;
  for (let i = 0; i < INITIAL_IMAGES_TO_RENDER_COUNT; i++) {
    const canvas = (await renderedCanvasses.next()).value;
    canvasses.appendChild(canvas);
  }
}

async function selectLanguage() {
  conversionDiv.scrollIntoView(SCROLL_INTO_VIEW_OPTIONS);

  const langUrl = langSelect.value;
  const langName = langSelect.name;

  gtag("event", "select_language", { language_name: langName });

  const langPromise = state.trainedData.has(langUrl)
    ? state.trainedData.get(langUrl)!
    : fetchBin(langUrl);
  state.trainedData.set(langUrl, langPromise);

  const [tesseractWasm, trainedData] = await Promise.all([
    state.tesseractWasmPromise,
    langPromise,
  ]);

  const sup = new Uint8Array(await state.sup!.supContent);
  state.srt = { text: "", progress: 0, blanks: [] };

  const startRender = "start_render";
  performance.mark(startRender);

  const srtIter = pipeline(sup, WORKER_URL, tesseractWasm, trainedData);
  let next = await srtIter.next();
  while (!next.done) {
    const [{ completed, total }, sub] = next.value;
    const percentComplete = completed / total;
    setPercentComplete(percentComplete);
    addSub(sub);
    next = await srtIter.next();
  }
  const endRender = "endRender";
  performance.mark(endRender);
  const renderTime = performance.measure("renderTime", startRender, endRender);
  console.info(`rendered in: ${renderTime.duration}`);

  saveButton.removeAttribute("disabled");

  state.srt.blanks = next.value;
  warnBlanks();
}

function warnBlanks() {
  const { blanks } = state.srt!;
  const blankCount = blanks.length;
  if (blankCount > 0) {
    const warn = blankCount > 1
      ? `${blankCount} blank subtitles at indices ${blanks.join(", ")}`
      : `one blank subtitle at index ${blanks[0]}`;
    warning.innerHTML = `<em>Warning:</em> ${warn}.
A <a href="https://github.com/wydengyre/pgs-to-srt">CLI tool</a> is available for extracting the relevant subtitle images.`;
    warning.style.display = "block";
  }
}

function saveSrt() {
  const srt = state.srt!.text;
  const supPath = state.sup!.supFile.name!;

  const downloadableLink = document.createElement("a");
  downloadableLink.setAttribute(
    "href",
    `data:text/plain;charset=utf-8,${encodeURIComponent(srt)}`,
  );
  downloadableLink.download = `${pathFilename(supPath)}.srt`;
  document.body.appendChild(downloadableLink);
  downloadableLink.click();
  document.body.removeChild(downloadableLink);
}

async function fetchBin(url: string | URL): Promise<Uint8Array> {
  const resp = await fetch(url);
  const ab = await resp.arrayBuffer();
  return new Uint8Array(ab);
}
