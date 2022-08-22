.PHONY: clean deps test

clean:
	rm -rf deps build

deps: deps/tesseract-wasm

test: deps
	deno test --unstable --allow-read --allow-write --allow-run deno

TESSERACT_WASM_URL := https://github.com/wydengyre/tesseract-wasm/releases/download/wydengyre-release-1/tesseract-wasm.zip

dir_guard=@mkdir -p $(@D)

define copy
$(dir_guard)
cp $< $@
endef

define unzip
$(dir_guard)
unzip -q -d $@ $<
endef

# see https://stackoverflow.com/a/32703728
# TODO: check integrity
build/tesseract-wasm.zip:
	$(dir_guard)
	curl -s -S -L -f $(TESSERACT_WASM_URL) -z $@ -o $@.tmp && mv -f $@.tmp $@ 2>/dev/null || rm -f $@.tmp $@

deps/tesseract-wasm: build/tesseract-wasm.zip
	$(unzip)
