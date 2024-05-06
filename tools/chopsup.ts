// Copyright (C) 2024 Wyden and Gyre, LLC
import { parse } from "../lib/parse.ts";
import { packetize, pgsSchema } from "../lib/transform.ts";
import { writeAll } from "std/streams/write_all.ts";

// chop a sup file down to X segment "packets". Useful for making test files

if (import.meta.main) {
  await run(Deno.args, Deno.stdout, Deno.stderr);
}

async function run(
  args: string[],
  outWriter: Deno.Writer,
  errWriter: Deno.Writer,
): Promise<void> {
  const [numSubsStr, supPath] = args;
  const numSubs = Number.parseInt(numSubsStr, 10);

  const sup = await Deno.readFile(supPath);

  const binParsed = parse(sup);
  const basicParsed = pgsSchema.parse(binParsed);
  const parsedSegments = basicParsed.segment;
  const groupedSegments = packetize(parsedSegments);

  let offset;
  for (let i = 0; i < numSubs + 1; i++) {
    offset = (await groupedSegments.next()).value.offset;
  }

  const choppedSup = sup.subarray(0, offset);
  await writeAll(outWriter, choppedSup);

  const report = `chopped sup to ${offset} bytes\n`;
  const te = new TextEncoder();
  const reportBytes = te.encode(report);
  await writeAll(errWriter, reportBytes);
}
