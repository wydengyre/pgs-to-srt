// Copyright (C) 2022 Wyden and Gyre, LLC
import { serve } from "std/http/server.ts";
import { PORT } from "./devconsts.ts";
import { fromFileUrl } from "std/path/mod.ts";
import { serveDir } from "std/http/file_server.ts";

// Development server. Not for production use.

const fsRoot = fromFileUrl(import.meta.resolve("../dist/browser/dev"));

async function main() {
  const handler = (req: Request): Promise<Response> => {
    return serveDir(req, { fsRoot });
  };

  await serve(handler, { port: PORT });
}

if (import.meta.main) {
  await main();
}
