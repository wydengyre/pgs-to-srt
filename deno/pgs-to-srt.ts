// Copyright (C) 2022 Wyden and Gyre, LLC
import { readAll } from "std/streams/conversion.ts";
import { extractImage } from "./extractImage.ts";
import { runConvert } from "./convert.ts";

const USAGE = "[LANGUAGE | SUBTITLE_INDEX]";
function fail(err?: string): never {
  if (err !== undefined) {
    console.error(err);
  }
  console.error(`arguments: ${USAGE}`);

  const ARBITRARY_EXIT_CODE = 1;
  Deno.exit(ARBITRARY_EXIT_CODE);
}

if (import.meta.main) {
  await pgsToSrt(Deno.args, Deno.stdin, Deno.stdout, Deno.stderr);
}

async function pgsToSrt(
  args: string[],
  inReader: Deno.Reader,
  outWriter: Deno.Writer,
  errWriter: Deno.Writer,
): Promise<void> {
  if (args.length < 2) {
    fail();
  }
  const [trainedDataPathOrIndex, supPath] = args;

  const supReader = supPath === "-" ? inReader : await Deno.open(supPath);

  // it feels kind of stupid that we don't support streaming this,
  // but these files tend to be in the tens of megabytes
  const sup = await readAll(supReader);

  const index = parseInt(trainedDataPathOrIndex, 10);
  return isNaN(index)
    ? runConvert(sup, trainedDataPathOrIndex, outWriter, errWriter)
    : extractImage(sup, index, outWriter);
}
