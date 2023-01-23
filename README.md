# pgs-to-srt

pgs-to-srt is a command-line tool for converting Blu-ray style PGS (aka .sup) subtitles to the SRT
format.

Because doing the conversion requires performing error-prone OCR on the image-based PGS format, it
also has tooling to help you extract the individual subtitle images.

A simple, web-based front-end to this tool is freely available
at [pgs-to-srt.com](https://pgs-to-srt.com). It does not involve uploading of any files, performing
the entire conversion in the browser.

## Installation

The main prerequisite is [deno](https://deno.land). You'll need
[`just`](https://github.com/casey/just) and [`curl`](https://curl.se) to build the project.


1. Clone this repo: `git clone --depth=1 git@github.com:wydengyre/pgs-to-srt.git`
2. Enter the resulting directory: `cd pgs-to-srt`
3. Install dependencies: `make deps`
4. (Optional, but recommended for ease of use) Install the main
   script: `deno install --allow-read --import-map import_map.json --name pgs-to-srt deno/main.ts`

Once installed, the onscreen instructions will give you tips for adding the tool to your `PATH`.

## Converting subtitles

You may need to download [tesseract trained data](https://github.com/wydengyre/tessdata_fast) for
the language of your subtitles. The previous link leads to "fast" trained data, which appears to
give very similar results, in much less time,
than ["best" trained data](https://github.com/wydengyre/tessdata_best).

Included in this repo are trained data sets for English and French.

Then, for example:

`pgs-to-srt test/eng.fast.traineddata test/lostillusions.first100.en.sup > results.srt`

## Extracting subtitle images

BMP is the only supported image format. To extract subtitle image 10, for example:

`pgs-to-srt 10 test/lostillusions.first100.en.sup > image10.bmp`
