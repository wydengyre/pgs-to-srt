import * as path from "std/path/mod.ts";
import { configPath } from "./build-config.ts";
import { run } from "./build-util.ts";

const CID_PATH = "docker.build.cid";
const bundleZipPath = configPath("bundleZip");

const bundleZipPathRelativeToBase = path.relative("..", bundleZipPath);

async function main() {
  await run("docker", "run", "--cidfile", CID_PATH, "pgs-to-srt-build");
  const cid = await Deno.readTextFile(CID_PATH);
  await Deno.remove(CID_PATH);

  const bundleZipDirPath = path.dirname(bundleZipPath);
  await Deno.mkdir(bundleZipDirPath, { recursive: true });
  await run(
    "docker",
    "cp",
    `${cid}:${bundleZipPathRelativeToBase}`,
    bundleZipPath,
  );
}

if (import.meta.main) {
  await main();
}
