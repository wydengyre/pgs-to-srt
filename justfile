#!/usr/bin/env just --justfile

tesseractWasmUrl := "https://github.com/wydengyre/tesseract-wasm/releases/download/wydengyre-release-1/tesseract-wasm.zip"
tesseractWasmZipPath := "build/tesseract-wasm.zip"
tesseractWasmFilesPath := "deps/tesseract-wasm"

default:
    just --list --justfile {{justfile()}}

clean:
	rm -rf deps build

fmt:
    deno fmt deno test

lint:
    deno lint deno test

update-deps:
    deno run -A https://deno.land/x/udd/main.ts import_map.json

deps:
    mkdir -p {{tesseractWasmFilesPath}} build
    curl --show-error --location --fail {{tesseractWasmUrl}} --output {{tesseractWasmZipPath}}
    unzip -q -o -d {{tesseractWasmFilesPath}} {{tesseractWasmZipPath}}

test: deps
	deno test --unstable --allow-read --allow-write --allow-run deno
