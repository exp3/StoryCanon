import { cp, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * tsc emits only what it compiles, so the query compiler's .wasm binary never
 * reaches dist on its own. It has to land next to the emitted glue code, which
 * imports it as "./query_compiler_fast_bg.wasm?module" — the form workerd
 * instantiates at deploy time instead of at request time.
 *
 * Only the workers client carries one; the Node client uses the compiler that
 * ships inside @prisma/client. Missing it is fatal rather than silent, because
 * the failure would otherwise surface as a 500 on the first query in production.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src", "workers");
const out = join(here, "dist", "workers");

async function* wasmFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* wasmFiles(full);
    else if (entry.name.endsWith(".wasm")) yield full;
  }
}

let copied = 0;
for await (const file of wasmFiles(src)) {
  await cp(file, join(out, relative(src, file)));
  copied += 1;
}

if (copied === 0) {
  console.error("No .wasm found under src/workers - the Worker would fail on its first query.");
  process.exit(1);
}

console.log(`Copied ${copied} wasm file(s) into dist/workers.`);
