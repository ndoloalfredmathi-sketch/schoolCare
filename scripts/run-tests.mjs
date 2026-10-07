/**
 * Lance la suite de tests compilée.
 *
 * Node 24 fournit `node:sqlite` nativement : inutile de démarrer Electron pour
 * tester le socle de données, ce qui rend la suite rapide et sans fenêtre.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "test-dist", "run.mjs");

if (!existsSync(entry)) {
  console.error(
    `Suite de tests introuvable : ${entry}\nLancez « npm run test:build » d'abord.`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [entry], {
  cwd: root,
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (cause) => {
  console.error(`Lancement des tests impossible : ${cause.message}`);
  process.exit(1);
});
