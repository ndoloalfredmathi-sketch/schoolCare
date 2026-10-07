import type { DatabaseSync } from "node:sqlite";
import { SCHEMA } from "./schema.js";

/**
 * Migrations de schéma versionnées via `PRAGMA user_version`.
 *
 * Règle : une migration est immuable une fois livrée. Pour faire évoluer le
 * schéma, ajouter une entrée à la fin du tableau — ne jamais modifier une entrée
 * existante, les bases installées ne la rejoueraient pas.
 */
const migrations: { version: number; sql: string }[] = [
  {
    version: 2,
    sql: `
      ALTER TABLE students ADD COLUMN updated_at TEXT;
      UPDATE students SET updated_at = created_at WHERE updated_at IS NULL;

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'system',
        payload TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
    `,
  },
  {
    // `datetime('now')` n'a qu'une précision à la seconde : deux modifications
    // rapprochées portaient le même horodatage, rendant l'historique ambigu.
    version: 3,
    sql: `
      UPDATE students
         SET created_at = strftime('%Y-%m-%d %H:%M:%f', created_at)
       WHERE created_at IS NOT NULL AND created_at NOT LIKE '%.%';

      UPDATE students
         SET updated_at = strftime('%Y-%m-%d %H:%M:%f', updated_at)
       WHERE updated_at IS NOT NULL AND updated_at NOT LIKE '%.%';

      UPDATE audit_log
         SET created_at = strftime('%Y-%m-%d %H:%M:%f', created_at)
       WHERE created_at IS NOT NULL AND created_at NOT LIKE '%.%';
    `,
  },
  {
    // Authentification : identifiants de connexion et mot de passe dérivé.
    // `must_change_password` force la rotation du mot de passe de démonstration.
    version: 4,
    sql: `
      ALTER TABLE users ADD COLUMN password_hash TEXT;
      ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN last_login_at TEXT;

      CREATE UNIQUE INDEX idx_users_email ON users(lower(email))
        WHERE email IS NOT NULL;

      INSERT OR IGNORE INTO users
        (id, role_id, display_name, email, is_active, password_hash, must_change_password)
      VALUES (
        1,
        1,
        'Administrateur',
        'admin@schoolcare.local',
        1,
        'pbkdf2$210000$Ab1HefBEgkDMZ1OuJFyHaQ==$uDqiOLINKSOcL3q3dw1REXQRxRfSoVmuOB3X0QEjawfD5cybQgly+HHM4CMb6PJ102ASzmdDrDbbx3avaHJtQQ==',
        1
      );
    `,
  },
];

export const LATEST_SCHEMA_VERSION = migrations.reduce(
  (max, migration) => Math.max(max, migration.version),
  1,
);

function readUserVersion(database: DatabaseSync): number {
  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;

  return Number(row?.user_version ?? 0);
}

export function migrate(database: DatabaseSync): number {
  let version = readUserVersion(database);

  // Base neuve (ou antérieure au versionnement) : on crée le schéma de base.
  if (version < 1) {
    database.exec("BEGIN");
    try {
      database.exec(SCHEMA);
      database.exec("PRAGMA user_version = 1");
      database.exec("COMMIT");
    } catch (cause) {
      database.exec("ROLLBACK");
      throw cause;
    }

    version = 1;
  }

  for (const migration of migrations) {
    if (migration.version <= version) {
      continue;
    }

    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      // `PRAGMA` n'accepte pas de paramètre lié : la valeur est numérique et
      // provient d'une constante du code, jamais d'une entrée utilisateur.
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (cause) {
      database.exec("ROLLBACK");
      throw new Error(
        `Migration de schéma ${migration.version} échouée`,
        { cause },
      );
    }

    version = migration.version;
  }

  return version;
}
