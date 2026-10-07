import { copyFile, mkdir, readdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";
import { getUserDataPath } from "../runtime.js";
import { getDatabase, getDatabasePath } from "./index.js";

/** Nombre de sauvegardes automatiques quotidiennes conservées. */
const RETENTION = 7;

export type BackupInfo = {
  fileName: string;
  path: string;
  size: number;
  modifiedAt: string;
};

export function getBackupDirectory(): string {
  return path.join(getUserDataPath(), "backups");
}

function stamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Sauvegarde cohérente de la base ouverte grâce à l'API backup de SQLite :
 * l'instantané reste valide même si une écriture est en cours.
 */
export async function createBackup(
  directory = getBackupDirectory(),
  prefix = "schoolcare",
): Promise<BackupInfo> {
  await mkdir(directory, { recursive: true });
  getDatabase();

  const target = path.join(directory, `${prefix}-${stamp()}.db`);
  const source: DatabaseSync = getDatabase();

  await sqliteBackup(source, target);

  return describe(target);
}

async function describe(filePath: string): Promise<BackupInfo> {
  const info = await stat(filePath);

  return {
    fileName: path.basename(filePath),
    path: filePath,
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
  };
}

export async function listBackups(): Promise<BackupInfo[]> {
  const directory = getBackupDirectory();

  try {
    const names = await readdir(directory);
    const files = names.filter((name) => name.endsWith(".db"));
    const described = await Promise.all(
      files.map((name) => describe(path.join(directory, name))),
    );

    return described.sort((left, right) =>
      right.modifiedAt.localeCompare(left.modifiedAt),
    );
  } catch {
    return [];
  }
}

/** Supprime les sauvegardes automatiques au-delà de la rétention. */
async function pruneBackups(): Promise<void> {
  const backups = (await listBackups()).filter((entry) =>
    entry.fileName.startsWith("schoolcare-"),
  );

  for (const entry of backups.slice(RETENTION)) {
    try {
      await unlink(entry.path);
    } catch (cause) {
      console.error("Suppression d'une sauvegarde échouée:", cause);
    }
  }
}

/**
 * Sauvegarde automatique quotidienne : au plus une par jour, purgée au-delà de
 * la rétention. Les erreurs ne doivent jamais empêcher le démarrage.
 *
 * Seules les sauvegardes automatiques (`schoolcare-…`) sont prises en compte :
 * un export manuel ou une copie avant restauration ne doit pas faire croire que
 * la sauvegarde du jour a déjà eu lieu.
 */
export async function runDailyBackup(): Promise<BackupInfo | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await listBackups();
    const automatic = existing.filter((entry) =>
      entry.fileName.startsWith("schoolcare-"),
    );

    if (automatic.some((entry) => entry.fileName.includes(today))) {
      return null;
    }

    const created = await createBackup();
    await pruneBackups();

    return created;
  } catch (cause) {
    console.error("Sauvegarde automatique échouée:", cause);
    return null;
  }
}

/** Vérifie qu'un fichier est bien une base SchoolCare lisible. */
export async function inspectBackupFile(
  filePath: string,
): Promise<{ ok: true; students: number; classes: number } | { ok: false; reason: string }> {
  let probe: DatabaseSync | null = null;

  try {
    const header = await readFile(filePath);
    const magic = header.subarray(0, 16).toString("latin1");

    if (!magic.startsWith("SQLite format 3")) {
      return { ok: false, reason: "Ce fichier n'est pas une base SQLite." };
    }

    probe = new DatabaseSync(filePath, { readOnly: true });

    const tables = probe
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('students','classes')",
      )
      .all() as { name: string }[];

    if (tables.length < 2) {
      return {
        ok: false,
        reason: "Ce fichier n'est pas une base SchoolCare (tables manquantes).",
      };
    }

    const students = probe
      .prepare("SELECT COUNT(*) AS total FROM students")
      .get() as { total: number };
    const classes = probe
      .prepare("SELECT COUNT(*) AS total FROM classes")
      .get() as { total: number };

    return { ok: true, students: students.total, classes: classes.total };
  } catch (cause) {
    return {
      ok: false,
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    probe?.close();
  }
}

/**
 * Remplace la base courante par le fichier fourni. La base actuelle est d'abord
 * archivée dans le dossier de sauvegardes, puis un redémarrage est requis.
 *
 * La base doit avoir été fermée par l'appelant avant d'appeler cette fonction :
 * `closeDatabase()` effectue le checkpoint du WAL, ce qui laisse un fichier
 * principal autosuffisant.
 */
export async function replaceDatabaseWith(
  sourcePath: string,
): Promise<{ safetyCopy: string }> {
  const target = getDatabasePath();
  const directory = getBackupDirectory();
  const safetyCopy = path.join(directory, `avant-restauration-${stamp()}.db`);

  await mkdir(directory, { recursive: true });

  // 1. Copie de sécurité de la base actuelle, avant tout remplacement.
  await copyFile(target, safetyCopy);

  // 2. Fichiers WAL résiduels de l'ancienne base : à retirer, sinon SQLite
  //    tenterait de les appliquer à la nouvelle base.
  for (const suffix of ["-wal", "-shm"]) {
    try {
      await unlink(`${target}${suffix}`);
    } catch {
      // Absent : rien à faire.
    }
  }

  // 3. Remplacement.
  await copyFile(sourcePath, target);

  return { safetyCopy };
}

/** Copie la base vers un emplacement choisi par l'utilisateur. */
export async function exportBackupTo(destination: string): Promise<BackupInfo> {
  const info = await createBackup(path.dirname(destination), "export");

  await rename(info.path, destination);

  return describe(destination);
}
