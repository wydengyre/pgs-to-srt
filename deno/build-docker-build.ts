import * as path from "std/path/mod.ts";
import { configPath } from "./build-config.ts";
import { run } from "./build-util.ts";

const CID_PATH = "docker.build.cid";
const distPath = configPath("distPath");
const distPathRelativeToBase = path.relative("..", distPath);

async function main() {
  await run("docker", "run", "--cidfile", CID_PATH, "pgs-to-srt-build");
  const cid = await Deno.readTextFile(CID_PATH);
  await Deno.remove(CID_PATH);

  await Deno.mkdir(distPathRelativeToBase, { recursive: true });
  await run(
    "docker",
    "cp",
    `${cid}:${distPathRelativeToBase}`,
    distPath,
  );
}

if (import.meta.main) {
  await main();
}
