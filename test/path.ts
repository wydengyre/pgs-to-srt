import { fromFileUrl } from "std/path/mod.ts";

export function getTestPath(fileName: string): string {
  return fromFileUrl(import.meta.resolve(`./${fileName}`));
}
