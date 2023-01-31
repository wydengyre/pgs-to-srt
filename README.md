# pgs-to-srt

This repository is home to the source code of the website [pgs-to-srt.com](https://pgs-to-srt.com),
as well as its corresponding command-line tool, `pgs-to-srt`. Both are tools for converting Blu-ray
style PGS (aka `.sup`) subtitles to the SRT format.

Because doing the conversion requires performing error-prone OCR on the image-based PGS format, it
also has tooling to help you extract the individual subtitle images.

## Installation

[Releases](https://github.com/wydengyre/pgs-to-srt/releases) are published on GitHub as zip files.

Uncompress the ZIP to a desired location. You may then install the main script, `pgs-to-srt.js`, to
facilitate use: `deno install --allow-read pgs-to-srt.js`. Onscreen instructions will provide tips
for adding the tool to your terminal `PATH`.

## Converting subtitles

The `tessdata_fast` directory of this repo contains Tesseract trained data files that can be used
to perform OCR on a variety of languages. You can download only those languages you need.

To use English, for example:

`pgs-to-srt tessdata_fast/eng.traineddata test/lostillusions.first100.en.sup > results.srt`

## Extracting subtitle images

BMP is the only supported image format. To extract subtitle image 10, for example:

`pgs-to-srt 10 test/lostillusions.first100.en.sup > image10.bmp`
