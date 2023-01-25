import { configVal } from "./build-config.ts";
import { run } from "./build-util.ts";

const dockerBuildImageName = configVal("dockerBuildImageName");

async function main() {
  await run(
    "docker",
    "build",
    "-f",
    "Dockerfile.build",
    "-t",
    dockerBuildImageName,
    ".",
  );
}

if (import.meta.main) {
  await main();
}
