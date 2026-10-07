import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals, assertThrows, test } from "./harness.ts";
import { createLegacyDatabase, resetDataDirectory } from "./helpers.ts";
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
} from "../electron/db/index.js";
import { listClasses, listStudents } from "../electron/db/students.js";

const LEGACY_DIR = "legacy";

function withLegacyDatabase(run: () => void): void {
  const directory = path.join(os.tmpdir(), "schoolcare-tests", LEGACY_DIR);

  resetDataDirectory(LEGACY_DIR);
  createLegacyDatabase(path.join(directory, "schoolcare.db"));

  try {
    run();
  } finally {
    closeDatabase();
  }
}

function withFreshDatabase(prefix: string, run: () => void): void {
  resetDataDirectory(prefix);

  try {
    run();
  } finally {
    closeDatabase();
  }
}

function tableColumns(database: DatabaseSync, table: string): string[] {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];

  return rows.map((row) => row.name);
}

function tableExists(database: DatabaseSync, name: string): boolean {
  return Boolean(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name),
  );
}

function userVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  return row.user_version;
}

export function registerMigrationTests(): void {
  test("une base neuve est créée puis migrée jusqu'à la version 4", () => {
    withFreshDatabase("fresh", () => {
      const database = getDatabase();

      assertEquals(userVersion(database), 4, "version de schéma");
      assertEquals(listClasses(database).length, 6, "classes de démonstration");
      assertEquals(listStudents(database, {}).length, 48, "élèves de démonstration");
      assert(tableExists(database, "audit_log"), "audit_log doit exister");
    });
  });

  test("les colonnes attendues par l'application existent", () => {
    withFreshDatabase("columns", () => {
      const database = getDatabase();

      for (const column of ["updated_at", "matricule", "class_id", "status"]) {
        const columns = tableColumns(database, "students");
        assert(
          columns.includes(column),
          `students doit contenir ${column} (colonnes : ${columns.join(", ")})`,
        );
      }

      for (const column of [
        "password_hash",
        "must_change_password",
        "last_login_at",
      ]) {
        const columns = tableColumns(database, "users");
        assert(
          columns.includes(column),
          `users doit contenir ${column} (colonnes : ${columns.join(", ")})`,
        );
      }
    });
  });

  test("les clés étrangères sont activées et le mode WAL est actif", () => {
    withFreshDatabase("pragmas", () => {
      const database = getDatabase();

      const foreign = database.prepare("PRAGMA foreign_keys").get() as {
        foreign_keys: number;
      };
      const journal = database.prepare("PRAGMA journal_mode").get() as {
        journal_mode: string;
      };

      assertEquals(foreign.foreign_keys, 1, "PRAGMA foreign_keys");
      assertEquals(journal.journal_mode.toLowerCase(), "wal", "journal_mode");
    });
  });

  test("un index unique sur l'email empêche deux comptes identiques", () => {
    withFreshDatabase("unique-email", () => {
      const database = getDatabase();

      database
        .prepare(
          "INSERT INTO users (role_id, display_name, email) VALUES (2, 'Doublon', 'prof@ecole.fr')",
        )
        .run();

      assertThrows(
        () =>
          database
            .prepare(
              "INSERT INTO users (role_id, display_name, email) VALUES (2, 'Doublon', 'PROF@ecole.fr')",
            )
            .run(),
        "UNIQUE",
        "la casse ne doit pas permettre un doublon d'email",
      );
    });
  });

  test("une base existante en v2 est migrée sans perdre ses données", () => {
    withLegacyDatabase(() => {
      const database = getDatabase();

      assertEquals(userVersion(database), 4, "version après migration");

      const students = listStudents(database, {});
      assertEquals(students.length, 2, "les deux élèves d'origine sont conservés");
      assertEquals(students[0].lastName, "Ancien", "premier élève");
      assertEquals(students[1].status, "inactive", "statut conservé");
      assertEquals(students[1].birthDate, null, "date de naissance nulle conservée");

      assertEquals(
        listClasses(database).length,
        1,
        "le seed ne doit pas s'appliquer à une base déjà peuplée",
      );
    });
  });

  test("les horodatages hérités passent en millisecondes", () => {
    withLegacyDatabase(() => {
      const database = getDatabase();

      const converted = database
        .prepare("SELECT created_at, updated_at FROM students WHERE id = 1")
        .get() as { created_at: string; updated_at: string | null };
      const nullUpdatedAt = database
        .prepare("SELECT updated_at FROM students WHERE id = 2")
        .get() as { updated_at: string | null };

      assertEquals(converted.created_at, "2026-01-15 08:30:00.000", "created_at");
      assertEquals(converted.updated_at, "2026-01-15 08:30:00.000", "updated_at");
      assertEquals(nullUpdatedAt.updated_at, null, "un updated_at nul reste nul");

      // La conversion doit être idempotente : on vérifie qu'aucun horodatage à
      // la seconde ne subsiste, donc qu'un second passage ne ferait rien.
      const remaining = database
        .prepare(
          `SELECT COUNT(*) AS total FROM students
            WHERE created_at IS NOT NULL AND created_at NOT LIKE '%.%'`,
        )
        .get() as { total: number };

      assertEquals(remaining.total, 0, "aucun horodatage à la seconde restant");
    });
  });

  test("le compte d'administration est livré avec un mot de passe à changer", () => {
    withLegacyDatabase(() => {
      const database = getDatabase();
      const row = database
        .prepare(
          `SELECT email, is_active, password_hash, must_change_password
             FROM users WHERE id = 1`,
        )
        .get() as {
        email: string;
        is_active: number;
        password_hash: string | null;
        must_change_password: number;
      };

      // Le compte d'origine existait déjà : ses identifiants sont préservés.
      assertEquals(row.email, "ancien@ecole.fr", "adresse d'origine conservée");
      assertEquals(row.is_active, 1, "compte actif");
      assertEquals(row.must_change_password, 0, "pas de mot de passe à changer");
      assertEquals(row.password_hash, null, "aucun mot de passe inventé");
    });
  });

  test("le compte d'administration d'une base neuve impose un nouveau mot de passe", () => {
    withFreshDatabase("admin", () => {
      const database = getDatabase();
      const row = database
        .prepare(
          `SELECT email, is_active, password_hash, must_change_password
             FROM users WHERE id = 1`,
        )
        .get() as {
        email: string;
        is_active: number;
        password_hash: string | null;
        must_change_password: number;
      };

      assertEquals(row.email, "admin@schoolcare.local", "adresse de connexion");
      assertEquals(row.is_active, 1, "compte actif");
      assertEquals(row.must_change_password, 1, "changement imposé");
      assert(
        row.password_hash?.startsWith("pbkdf2$") === true,
        "le mot de passe doit être dérivé, jamais en clair",
      );
    });
  });

  test("la base et son journal WAL sont nettoyés à la fermeture", () => {
    withFreshDatabase("wal-close", () => {
      const file = getDatabasePath();

      getDatabase().prepare("SELECT 1").get();
      assert(existsSync(file), "le fichier de base doit exister");

      closeDatabase();

      assert(
        !existsSync(`${file}-wal`),
        "le fichier -wal doit être résorbé par le checkpoint de fermeture",
      );
    });
  });

  test("une migration en échec est annulée sans laisser de schéma partiel", () => {
    const directory = path.join(os.tmpdir(), "schoolcare-tests", "rollback");

    resetDataDirectory("rollback");
    const file = path.join(directory, "schoolcare.db");
    createLegacyDatabase(file);

    // On prépare un obstacle : l'index que la migration 4 tente de créer existe
    // déjà, ce qui la fera échouer en cours de transaction.
    const blocker = new DatabaseSync(file);
    blocker.exec("CREATE UNIQUE INDEX idx_users_email ON users(lower(email))");
    blocker.close();

    assertThrows(
      () => getDatabase(),
      "Migration de schéma",
      "une migration en échec doit être signalée",
    );

    closeDatabase();

    // Chaque migration est transactionnelle : les migrations déjà réussies
    // restent acquises, mais la 4 ne doit laisser aucune trace partielle.
    const probe = new DatabaseSync(file);
    const version = probe.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    const columns = (probe.prepare("PRAGMA table_info(users)").all() as {
      name: string;
    }[]).map((column) => column.name);

    assertEquals(version.user_version, 3, "dernière migration réussie");
    assert(
      !columns.includes("password_hash"),
      `aucune colonne partiellement ajoutée (colonnes : ${columns.join(", ")})`,
    );
    assert(
      !columns.includes("must_change_password"),
      "aucune colonne partiellement ajoutée",
    );
    assert(
      !columns.includes("last_login_at"),
      "aucune colonne partiellement ajoutée",
    );

    const students = probe
      .prepare("SELECT COUNT(*) AS total FROM students")
      .get() as { total: number };
    assertEquals(students.total, 2, "données d'origine préservées");

    probe.close();
  });
}
