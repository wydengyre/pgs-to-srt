# pgs-to-srt

pgs-to-srt is a command-line tool for converting Blu-ray style PGS (aka .sup) subtitles to the SRT
format.

Because doing the conversion requires performing error-prone OCR on the image-based PGS format, it
also has tooling to help you extract the individual subtitle images.

A simple, web-based front-end to this tool is freely available
at [pgs-to-srt.com](https://pgs-to-srt.com). It does not involve uploading of any files, performing
the entire conversion in the browser.

## Installation

[Releases](https://github.com/wydengyre/pgs-to-srt/releases) are published on GitHub as zip files.

Uncompress the ZIP to a desired location. You may then install the main script, `pgs-to-srt.js`, to
facilitate use: `deno install --allow-read pgs-to-srt.js`. Onscreen instructions will provide tips
for adding the tool to your terminal `PATH`.

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
