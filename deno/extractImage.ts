// Copyright (C) 2023 Wyden and Gyre, LLC
import { iterOds, packetize, pgsSchema } from "../lib/transform.ts";
import { parse } from "../lib/parse.ts";
import { render } from "../lib/render.ts";
import * as bitmap from "bitmap";
import { BitmapBufferAPI } from "bitmap";
import { writeAll } from "std/streams/conversion.ts";

export async function extractImage(
  sup: Uint8Array,
  imageIndex: number,
  outWriter: Deno.Writer,
) {
  const result = parse(sup);
  const basicParsed = pgsSchema.parse(result);
  const parsedSegments = basicParsed.segment;
  const groupedSegments = packetize(parsedSegments);
  const unrendered = iterOds(groupedSegments);
  // now get ods number whatever
  let subIndex = 1;
  let next = await unrendered.next();
  for (; subIndex < imageIndex; subIndex++) {
    next = await unrendered.next();
  }
  const wanted = next.value;
  const rendered = render(wanted.ods, wanted.pds);
  const bmpRgba32 = rendered.rgba;
  // this will fail on big endian systems
  const bmpAbgr8 = new Uint8Array(bmpRgba32.buffer);

  const bmpBuffer = BitmapBufferAPI.from(bmpAbgr8);
  const bmp = bitmap.Encoder({
    width: rendered.width,
    height: rendered.height,
    data: bmpBuffer,
  });
  await writeAll(outWriter, bmp.data);
}
