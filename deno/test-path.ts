import { fromFileUrl, join } from "std/path/mod.ts";

const TEST_DIR = fromFileUrl(import.meta.resolve("../test"));

export function getTestPath(fileName: string): string {
  return join(TEST_DIR, fileName);
}
