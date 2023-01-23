import * as path from "std/path/mod.ts";

// TODO: timeout support
export async function run(bin: string, ...args: string[]) {
  const cwd = path.fromFileUrl(import.meta.resolve("./.."));
  const command = new Deno.Command(bin, { args, cwd });
  const child = command.spawn();
  const { success, code } = await child.status;
  if (!success) {
    throw `${bin} ${args} failed with code ${code}`;
  }
}
