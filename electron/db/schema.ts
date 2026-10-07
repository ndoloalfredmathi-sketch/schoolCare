/**
 * Schéma de base de SchoolCare (version 1).
 *
 * Toute évolution ultérieure doit passer par une migration dans `migrations.ts`
 * et non par une modification de ce fichier : les bases déjà installées ne
 * rejouent jamais `SCHEMA`.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  level TEXT NOT NULL,
  academic_year TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT NOT NULL UNIQUE,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('F', 'M')),
  birth_date TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name, first_name);

INSERT OR IGNORE INTO roles (id, key, label) VALUES
  (1, 'admin', 'Administrateur'),
  (2, 'teacher', 'Enseignant'),
  (3, 'parent', 'Parent'),
  (4, 'student', 'Eleve');
`;
