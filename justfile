#!/usr/bin/env just --justfile

tesseractWasmUrl := "https://github.com/wydengyre/tesseract-wasm/releases/download/wydengyre-release-1/tesseract-wasm.zip"
tesseractWasmZipPath := "build/tesseract-wasm.zip"
tesseractWasmFilesPath := "deps/tesseract-wasm"

default:
    just --list --justfile {{justfile()}}

clean:
	rm -rf deps build dist

ci: ci-fmt lint deps build test

ci-fmt:
    deno fmt --check deno test deno-test

fmt:
    deno fmt deno test deno-test

lint:
    deno lint deno test deno-test

update-deps:
    deno run -A https://deno.land/x/udd/main.ts import_map.json

deps:
    mkdir -p {{tesseractWasmFilesPath}} build
    curl --show-error --location --fail {{tesseractWasmUrl}} --output {{tesseractWasmZipPath}}
    unzip -q -o -d {{tesseractWasmFilesPath}} {{tesseractWasmZipPath}}

test: unit-test end-to-end-test

unit-test:
	deno test --check=all --unstable --allow-read --allow-write --allow-run deno

end-to-end-test:
	deno test --check=all --unstable --allow-read --allow-write --allow-run deno-test

build:
    deno run --check=all --unstable --allow-read=./ --allow-run=deno,zip --allow-write=build,dist deno/build.ts

docker-ci: clean docker-build-image docker-run-build

docker-build-image:
    deno run --unstable --allow-run=docker deno/build-docker-image.ts

docker-run-build:
    deno run --unstable --allow-read=./ --allow-write=./ --allow-run=docker deno/build-docker-build.ts
