#!/usr/bin/env just --justfile

tesseractWasmUrl := "https://github.com/wydengyre/tesseract-wasm/releases/download/wydengyre-release-1/tesseract-wasm.zip"
tesseractWasmZipPath := "build/tesseract-wasm.zip"
tesseractWasmFilesPath := "deps/tesseract-wasm"

picoCssUrl := "https://github.com/picocss/pico/archive/refs/tags/v1.5.6.zip"
picoCssZipPath := "build/picocss.zip"
picoCssFilesPath := "deps/picocss"

default:
    just --list --justfile {{justfile()}}

clean:
	rm -rf deps build dist

ci: ci-fmt lint deps build test

ci-fmt:
    deno fmt --check deno deno-test test web

fmt:
    deno fmt deno deno-test test web

lint:
    deno lint deno test deno-test

web-build:
    deno run --allow-env --allow-net --allow-read --allow-write --allow-run web/build.ts

web-check:
    deno check --config web/deno.jsonc web/main.ts

web-serve:
    deno run --allow-net --allow-read=. web/serve.ts

update-deps:
    deno run -A https://deno.land/x/udd/main.ts import_map.json

deps:
    mkdir -p {{tesseractWasmFilesPath}} {{picoCssFilesPath}} build
    curl --show-error --location --fail {{tesseractWasmUrl}} --output {{tesseractWasmZipPath}}
    curl --show-error --location --fail {{picoCssUrl}} --output {{picoCssZipPath}}
    unzip -q -o -d {{tesseractWasmFilesPath}} {{tesseractWasmZipPath}}
    unzip -q -o -d {{picoCssFilesPath}} {{picoCssZipPath}}

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
