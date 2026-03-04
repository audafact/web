#!/usr/bin/env node
/**
 * Copies lame.min.js from node_modules to public/ for the MP3 encoder worker.
 * Run after npm install if lamejs is updated.
 */
import { copyFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "../node_modules/lamejs/lame.min.js");
const dest = join(__dirname, "../public/lame.min.js");

if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log("Copied lame.min.js to public/");
} else {
  console.warn("lamejs not found at", src, "- run npm install");
}
