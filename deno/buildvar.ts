import { writeAll } from "std/streams/write_all.ts";
import buildConfig from "./build.json" assert { type: "json" };

async function main(args: string[], outWriter: Deno.Writer) {
  const varName = args[0];
  const varVal = getVar(varName);
  const varValBytes = new TextEncoder().encode(varVal);
  await writeAll(outWriter, varValBytes);
}

export function getVar(name: string): string {
  // type annoyance
  const loosenedConf: Record<string, string> = buildConfig;
  const attempt = loosenedConf[name];
  if (typeof attempt !== "string") {
    throw `type of ${attempt}: ${typeof attempt}. Expected string.`
  }
  return attempt;
}

if (import.meta.main) {
  await main(Deno.args, Deno.stdout);
}
