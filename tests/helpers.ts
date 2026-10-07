import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Répertoire de données isolé pour toute la suite : les tests ne doivent jamais
 * approcher la base réelle de l'utilisateur.
 */
export const TEST_DATA_DIR = path.join(os.tmpdir(), "schoolcare-tests");

/**
 * Prépare un dossier de données vierge pour une suite et le déclare comme
 * dossier utilisateur : c'est ce qui garantit qu'une suite ne voit jamais la
 * base d'une autre. `getDatabase()` relit cette variable à chaque ouverture.
 */
export function resetDataDirectory(prefix: string): string {
  const directory = path.join(TEST_DATA_DIR, prefix);

  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  process.env.SCHOOLCARE_USER_DATA = directory;

  return directory;
}

/**
 * Schéma tel qu'il existait en version 2, recopié volontairement : le test doit
 * reproduire une base ancienne réelle, jamais le schéma courant.
 */
export const LEGACY_SCHEMA = `
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, label TEXT NOT NULL
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, level TEXT NOT NULL, academic_year TEXT NOT NULL
);
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT NOT NULL UNIQUE,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('F','M')),
  birth_date TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_students_class ON students(class_id);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Crée une base au schéma v2 avec deux élèves, prête à être migrée. */
export function createLegacyDatabase(filePath: string): void {
  const database = new DatabaseSync(filePath);

  database.exec(LEGACY_SCHEMA);
  database.exec(`
    INSERT INTO roles (id, key, label) VALUES (1, 'admin', 'Administrateur');
    INSERT INTO users (id, role_id, display_name, email) VALUES (1, 1, 'Ancien', 'ancien@ecole.fr');
    INSERT INTO classes (id, name, level, academic_year) VALUES (1, '6e A', '6e', '2025-2026');
  `);

  database
    .prepare(
      `INSERT INTO students
         (matricule, last_name, first_name, gender, birth_date, class_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 'active', '2026-01-15 08:30:00', '2026-01-15 08:30:00')`,
    )
    .run("SC-2026-0001", "Ancien", "Eleve", "M", "2011-05-05");

  database
    .prepare(
      `INSERT INTO students
         (matricule, last_name, first_name, gender, birth_date, class_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 'inactive', '2026-01-16 09:00:00')`,
    )
    .run("SC-2026-0002", "Autre", "Eleve", "F", null);

  database
    .prepare(
      `INSERT INTO audit_log (entity, entity_id, action, actor, payload, created_at)
       VALUES ('student', 1, 'create', 'system', '{}', '2026-01-15 08:30:00')`,
    )
    .run();

  database.exec("PRAGMA user_version = 2");
  database.close();
}

export const DEFAULT_CLASS_ID = 1;
