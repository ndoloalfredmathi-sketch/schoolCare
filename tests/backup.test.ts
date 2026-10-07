import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";
import { assert, assertEquals, test } from "./harness.ts";
import { resetDataDirectory } from "./helpers.ts";
import { closeDatabase, getDatabase, getDatabasePath } from "../electron/db/index.js";
import {
  createBackup,
  exportBackupTo,
  getBackupDirectory,
  inspectBackupFile,
  listBackups,
  replaceDatabaseWith,
  runDailyBackup,
} from "../electron/db/backup.js";
import { createStudent, listStudents } from "../electron/db/students.js";
import type { StudentInput } from "../src/types/models.js";

function studentInput(classId: number, lastName: string): StudentInput {
  return {
    lastName,
    firstName: "Test",
    gender: "F",
    birthDate: "2012-01-01",
    classId,
  };
}

export function registerBackupTests(): void {
  test("une sauvegarde est créée, nommée et listée", async () => {
    resetDataDirectory("backup-basic");

    try {
      const database = getDatabase();
      const created = await createBackup();

      assert(created.size > 0, "le fichier de sauvegarde ne doit pas être vide");
      assert(
        /^schoolcare-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/.test(created.fileName),
        `nom inattendu : ${created.fileName}`,
      );
      assert(existsSync(created.path), "le fichier doit exister sur le disque");

      const listed = await listBackups();
      assert(
        listed.some((entry) => entry.path === created.path),
        "la sauvegarde doit apparaître dans la liste",
      );

      const inspection = await inspectBackupFile(created.path);
      assert(inspection.ok, "la sauvegarde doit être reconnue comme valide");

      if (inspection.ok) {
        assertEquals(
          inspection.students,
          listStudents(database, {}).length,
          "nombre d'élèves sauvegardés",
        );
        assertEquals(inspection.classes, 6, "nombre de classes sauvegardées");
      }
    } finally {
      closeDatabase();
    }
  });

  test("une sauvegarde contient l'état exact au moment voulu", async () => {
    resetDataDirectory("backup-snapshot");

    try {
      const database = getDatabase();
      const classId = database.prepare("SELECT id FROM classes LIMIT 1").get() as {
        id: number;
      };

      createStudent(database, studentInput(classId.id, "AvantSauvegarde"));
      const expected = listStudents(database, {}).length;

      const backup = await createBackup();

      // Après la sauvegarde, on ajoute un élève : il ne doit pas s'y trouver.
      createStudent(database, studentInput(classId.id, "ApresSauvegarde"));

      const inspection = await inspectBackupFile(backup.path);
      assert(inspection.ok, "sauvegarde lisible");

      if (inspection.ok) {
        assertEquals(inspection.students, expected, "la sauvegarde fige l'état");
      }
    } finally {
      closeDatabase();
    }
  });

  test("un fichier étranger est refusé avec une raison explicite", async () => {
    resetDataDirectory("backup-invalid");

    try {
      getDatabase();
      const directory = getBackupDirectory();

      // Le dossier de sauvegardes n'existe qu'après une première sauvegarde.
      mkdirSync(directory, { recursive: true });

      const notSqlite = path.join(directory, "texte.db");
      writeFileSync(notSqlite, "ceci n'est pas une base", "utf8");

      const notSqliteResult = await inspectBackupFile(notSqlite);
      assert(!notSqliteResult.ok, "un fichier texte doit être refusé");

      if (!notSqliteResult.ok) {
        assert(
          notSqliteResult.reason.includes("SQLite"),
          `raison inattendue : ${notSqliteResult.reason}`,
        );
      }

      // Base SQLite valide mais dépourvue des tables attendues.
      const noTables = path.join(directory, "sans-tables.db");
      const emptyDatabase = new DatabaseSync(noTables);
      emptyDatabase.exec("CREATE TABLE autre (id INTEGER)");
      emptyDatabase.close();

      const noTablesResult = await inspectBackupFile(noTables);
      assert(!noTablesResult.ok, "une base sans les tables attendues doit être refusée");

      const missing = await inspectBackupFile(path.join(directory, "absent.db"));
      assert(!missing.ok, "un fichier absent doit être refusé");
    } finally {
      closeDatabase();
    }
  });

  test("la sauvegarde quotidienne n'a lieu qu'une fois par jour", async () => {
    resetDataDirectory("backup-daily");

    try {
      getDatabase();

      const first = await runDailyBackup();
      assert(first !== null, "la première sauvegarde du jour doit être créée");

      const before = (await listBackups()).length;
      const second = await runDailyBackup();

      assertEquals(second, null, "un second appel le même jour ne fait rien");
      assertEquals((await listBackups()).length, before, "aucun fichier ajouté");
    } finally {
      closeDatabase();
    }
  });

  test("la rétention limite le nombre de sauvegardes automatiques", async () => {
    resetDataDirectory("backup-retention");

    try {
      const database = getDatabase();
      const directory = getBackupDirectory();
      const day = 24 * 60 * 60 * 1000;

      mkdirSync(directory, { recursive: true });

      // On simule des sauvegardes des douze derniers jours, sauf celle du jour
      // pour que la sauvegarde quotidienne s'exécute réellement.
      for (let index = 1; index <= 12; index += 1) {
        const stamp = new Date(Date.now() - index * day)
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);

        await sqliteBackup(database, path.join(directory, `schoolcare-${stamp}.db`));
      }

      assertEquals(
        (await listBackups()).length,
        12,
        "douze sauvegardes simulées en place",
      );

      const created = await runDailyBackup();
      assert(created !== null, "la sauvegarde du jour doit être créée");

      const automatic = (await listBackups()).filter((entry) =>
        entry.fileName.startsWith("schoolcare-"),
      );

      assertEquals(automatic.length, 7, "rétention à sept sauvegardes");
      assert(
        automatic.some((entry) => entry.path === created.path),
        "la sauvegarde du jour doit être conservée",
      );
    } finally {
      closeDatabase();
    }
  });

  test("une restauration remplace les données par celles de la sauvegarde", async () => {
    resetDataDirectory("backup-restore");

    try {
      const database = getDatabase();
      const classId = (
        database.prepare("SELECT id FROM classes LIMIT 1").get() as { id: number }
      ).id;

      createStudent(database, studentInput(classId, "Conserve"));
      const expected = listStudents(database, {}).length;
      const backup = await createBackup();

      // Un élève ajouté après la sauvegarde doit disparaître à la restauration.
      createStudent(database, studentInput(classId, "Perdu"));
      assertEquals(
        listStudents(database, {}).length,
        expected + 1,
        "l'élève supplémentaire est bien présent",
      );

      closeDatabase();

      const { safetyCopy } = await replaceDatabaseWith(backup.path);

      assert(existsSync(safetyCopy), "une copie de sécurité doit être créée");
      assert(
        readFileSync(safetyCopy).byteLength > 0,
        "la copie de sécurité ne doit pas être vide",
      );

      const reopened = getDatabase();

      assertEquals(
        listStudents(reopened, {}).length,
        expected,
        "les données reviennent à l'état sauvegardé",
      );
      assertEquals(
        listStudents(reopened, { search: "Perdu" }).length,
        0,
        "l'élève postérieur à la sauvegarde a disparu",
      );
      assertEquals(
        listStudents(reopened, { search: "Conserve" }).length,
        1,
        "l'élève sauvegardé est présent",
      );

      const version = reopened.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      assertEquals(version.user_version, 4, "le schéma de la sauvegarde est préservé");
    } finally {
      closeDatabase();
    }
  });

  test("la restauration fonctionne aussi sur une base migrée vers un schéma plus récent", async () => {
    resetDataDirectory("backup-restore-legacy");

    try {
      getDatabase();
      const backup = await createBackup();

      closeDatabase();

      await replaceDatabaseWith(backup.path);

      const reopened = getDatabase();
      const version = reopened.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };

      assertEquals(version.user_version, 4, "version de schéma après restauration");
      assertEquals(listStudents(reopened, {}).length, 48, "population restaurée");
    } finally {
      closeDatabase();
    }
  });

  test("un export écrit une copie utilisable à l'emplacement demandé", async () => {
    resetDataDirectory("backup-export");

    try {
      getDatabase();

      const destination = path.join(getBackupDirectory(), "..", "export-test.db");
      const exported = await exportBackupTo(destination);

      assertEquals(exported.path, destination, "chemin de l'export");
      assert(existsSync(destination), "le fichier exporté doit exister");

      const inspection = await inspectBackupFile(destination);
      assert(inspection.ok, "l'export doit être une sauvegarde valide");
    } finally {
      closeDatabase();
    }
  });

  test("le chemin de la base reste dans le dossier de données", () => {
    resetDataDirectory("backup-paths");

    try {
      const file = getDatabasePath();

      assert(
        file.endsWith("schoolcare.db"),
        `nom de fichier inattendu : ${file}`,
      );
      assert(
        getBackupDirectory().startsWith(path.dirname(file)),
        "les sauvegardes doivent voisiner la base",
      );
    } finally {
      closeDatabase();
    }
  });
}
