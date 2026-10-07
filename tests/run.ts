/**
 * Point d'entrée de la suite de tests.
 *
 * Compilé par `npm run test:build` puis exécuté par Node (`npm test`). Node 24
 * fournit `node:sqlite`, et `electron/runtime.ts` sait fonctionner hors
 * d'Electron : aucun lancement de fenêtre n'est nécessaire pour tester le socle
 * de données.
 */
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSuites } from "./harness.ts";
import { registerMigrationTests } from "./migrations.test.ts";
import { registerPasswordTests } from "./password.test.ts";
import { registerAuthTests } from "./auth.test.ts";
import { registerStudentTests } from "./students.test.ts";
import { registerBackupTests } from "./backup.test.ts";

const BASE_DIR = path.join(os.tmpdir(), "schoolcare-tests");

// Jamais la base réelle de l'utilisateur.
process.env.SCHOOLCARE_USER_DATA = BASE_DIR;

async function main(): Promise<void> {
  rmSync(BASE_DIR, { recursive: true, force: true });
  mkdirSync(BASE_DIR, { recursive: true });

  console.log("SchoolCare — suite de tests");
  console.log(`Données de test : ${BASE_DIR}`);

  const failures = await runSuites([
    { name: "Migrations", register: registerMigrationTests },
    { name: "Mots de passe", register: registerPasswordTests },
    { name: "Authentification", register: registerAuthTests },
    { name: "Élèves", register: registerStudentTests },
    { name: "Sauvegardes", register: registerBackupTests },
  ]);

  rmSync(BASE_DIR, { recursive: true, force: true });

  process.exit(failures === 0 ? 0 : 1);
}
void main();
