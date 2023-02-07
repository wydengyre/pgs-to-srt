// Copyright (C) 2022 Wyden and Gyre, LLC
import { serve } from "std/http/server.ts";
import { serveDir } from "std/http/file_server.ts";
import { configPath, configVal } from "./build-conf.ts";

// Development server. Not for production use.

const port = configVal("devPort");
const distDir = configPath("distDir");

async function main() {
  const handler = (req: Request): Promise<Response> => {
    return serveDir(req, { fsRoot: distDir });
  };

  await serve(handler, { port });
}

if (import.meta.main) {
  await main();
}
