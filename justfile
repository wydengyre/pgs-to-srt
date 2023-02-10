#!/usr/bin/env just --justfile

set dotenv-load := true

tesseractWasmUrl := "https://github.com/wydengyre/tesseract-wasm/releases/download/wydengyre-release-1/tesseract-wasm.zip"
tesseractWasmZipPath := "build/tesseract-wasm.zip"
tesseractWasmFilesPath := "deps/tesseract-wasm"

picoCssUrl := "https://github.com/picocss/pico/archive/refs/tags/v1.5.6.zip"
picoCssZipPath := "build/picocss.zip"
picoCssFilesPath := "deps/picocss"

default:
    just --list --justfile {{justfile()}}

clean:
	rm -rf deps build dist web/node_modules

# install dependencies
deps:
    mkdir -p {{tesseractWasmFilesPath}} {{picoCssFilesPath}} build
    curl --show-error --location --fail {{tesseractWasmUrl}} --output {{tesseractWasmZipPath}}
    curl --show-error --location --fail {{picoCssUrl}} --output {{picoCssZipPath}}
    unzip -q -o -d {{tesseractWasmFilesPath}} {{tesseractWasmZipPath}}
    unzip -q -o -d {{picoCssFilesPath}} {{picoCssZipPath}}

# run all ci checks
ci: ci-fmt lint deps build test web-check-lib web-build-lib web-install-deps web-check-main web-build

# ci formatting check
ci-fmt:
    deno fmt --check deno deno-test test web

# reformat all files
fmt:
    deno fmt deno deno-test test web

lint:
    deno lint deno test deno-test

# check web types
web-check-lib:
    deno check --config web/deno.jsonc web/lib.ts

# build web libs
web-build-lib:
    deno run --allow-env --allow-net --allow-read --allow-write --allow-run web/build-lib.ts

web-check-main:
    cd web && npx tsc

# install web deps
web-install-deps:
    cd web && npm install

# build for the web
web-build:
    deno run --allow-env --allow-net --allow-read --allow-write --allow-run web/build.ts

# run development web server for local QA
web-serve:
    deno run --allow-net --allow-read=. web/serve.ts

web-deploy: web-check-lib web-build web-s3-sync web-cloudflare-cache-purge

# deploy web to s3
web-s3-sync:
    aws s3 sync ./dist/web "$S3_BUCKET"

# show what s3 deployment would do
web-s3-sync-dryrun:
    aws s3 sync --dryrun ./dist/web "$S3_BUCKET"

# reset cloudflare cache
web-cloudflare-cache-purge:
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
         --data '{"purge_everything":true}'

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
