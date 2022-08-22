// Copyright (C) 2022 Wyden and Gyre, LLC
import { Buffer } from "std/io/buffer.ts";
import { getTestPath } from "../test/path.ts";
import { extractImage } from "./extractImage.ts";
import { assertEquals } from "std/testing/asserts.ts";

Deno.test("extraction of an image", async () => {
  const IMAGE_INDEX = 2; // somewhat arbitrary

  const inSupPath = getTestPath("lostillusions.first100.fr.sup");
  const outBmpPath = getTestPath("lostillusions.fr.sub2.bmp");

  const [inSup, outBmp] = await Promise.all([
    Deno.readFile(inSupPath),
    Deno.readFile(outBmpPath),
  ]);

  const outBuffer = new Buffer();
  await extractImage(inSup, IMAGE_INDEX, outBuffer);
  const outBytes = outBuffer.bytes({ copy: false });

  assertEquals(outBytes, outBmp);
});
