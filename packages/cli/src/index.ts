#!/usr/bin/env node

import { createServer, build as viteBuild } from "vite";
import { extro } from "@extro/vite-plugin";

const command = process.argv[2];
const root = process.cwd();

async function dev() {
  const server = await createServer({
    root,
    plugins: [extro({ root })],
  });

  await server.listen();

  console.log("Extro dev server running");
}

async function build() {
  console.log("Building extension...");

  await viteBuild({
    root,
    plugins: [extro({ root })],
  });

  console.log("Build complete");
}

switch (command) {
  case "dev":
    await dev();
    break;

  case "build":
    await build();
    break;

  case "init":
    console.log("Initializing Extro project...");
    break;

  default:
    console.log("Extro CLI");
}
