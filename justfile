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

# install dependencies
deps:
    mkdir -p {{tesseractWasmFilesPath}} {{picoCssFilesPath}} build
    curl --show-error --location --fail {{tesseractWasmUrl}} --output {{tesseractWasmZipPath}}
    curl --show-error --location --fail {{picoCssUrl}} --output {{picoCssZipPath}}
    unzip -q -o -d {{tesseractWasmFilesPath}} {{tesseractWasmZipPath}}
    unzip -q -o -d {{picoCssFilesPath}} {{picoCssZipPath}}

# run all ci checks
ci: ci-fmt lint deps web-check build test web-build

# ci formatting check
ci-fmt:
    deno fmt --check deno deno-test test web

# reformat all files
fmt:
    deno fmt deno deno-test test web

lint:
    deno lint deno test deno-test

# check web types
web-check:
    deno check --config web/deno.jsonc web/main.ts

# build for the web
web-build:
    deno run --allow-env --allow-net --allow-read --allow-write --allow-run web/build.ts

# run development web server for local QA
web-serve:
    deno run --allow-net --allow-read=. web/serve.ts

web-deploy: web-check web-build web-s3-sync web-cloudflare-cache-purge

# deploy web to s3
web-s3-sync:
    aws s3 sync ./dist/web s3://pgs-to-srt.com

# reset cloudflare cache
web-cloudflare-cache-purge:
    echo "Please manually purge the cloudflare cache for pgs-to-srt.com"

# update dependencies to latest versions
update-deps:
    deno run -A https://deno.land/x/udd/main.ts import_map.json

# run all tests
test: unit-test end-to-end-test

# run unit tests
unit-test:
	deno test --check=all --unstable --allow-read --allow-write --allow-run deno

# run end-to-end deno testing
end-to-end-test:
	deno test --check=all --unstable --allow-read --allow-write --allow-run deno-test

# build for deno distribution
build:
    deno run --check=all --unstable --allow-read=./ --allow-run=deno,zip --allow-write=build,dist deno/build.ts

# run docker-based ci
docker-ci: clean docker-build-image docker-run-build

# build docker image
docker-build-image:
    deno run --unstable --allow-run=docker deno/build-docker-image.ts

# run docker ci build image
docker-run-build:
    deno run --unstable --allow-read=./ --allow-write=./ --allow-run=docker deno/build-docker-build.ts
