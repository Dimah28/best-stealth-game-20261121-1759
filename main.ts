// Velvet Hour — the hand-in program for make.fun (Node 22, stdlib only).
// One clear job: copy the game and its screenshots into /output and write
// the dossier the kit's library builds from them, byte for byte.
//
// The grader runs this twice in a fresh container with no network, a
// read-only repository and a writable /output; both runs must write the same
// bytes. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyClean(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) throw new Error(`missing ${name}/ in the repository`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyClean('game');
copyClean('screenshots');

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
const dossierPath = join(outDir, 'dossier.json');
rmSync(dossierPath, { force: true });
writeFileSync(dossierPath, dossier);
