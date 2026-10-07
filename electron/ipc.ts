import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type {
  RestoreResult,
  StudentInput,
  StudentQuery,
} from "../src/types/models.js";
import { closeDatabase, getDatabase } from "./db/index.js";
import {
  createBackup,
  exportBackupTo,
  inspectBackupFile,
  listBackups,
  replaceDatabaseWith,
} from "./db/backup.js";
import {
  changePassword,
  getAuthState,
  listAccounts,
  login,
  logout,
  requireAuthenticated,
} from "./auth/session.js";
import {
  createStudent,
  deleteStudent,
  getStudent,
  listAuditForStudent,
  listClasses,
  listRecentStudents,
  listStudents,
  listStudentsPage,
  updateStudent,
} from "./db/students.js";

async function uniquePath(
  directory: string,
  filename: string,
): Promise<string> {
  const extension = extname(filename);
  const base = basename(filename, extension);
  let candidate = join(directory, filename);
  let counter = 1;

  while (existsSync(candidate)) {
    candidate = join(directory, `${base} (${counter})${extension}`);
    counter += 1;
  }

  return candidate;
}

/** Fenêtre parente d'un appel IPC, pour rattacher les dialogues système. */
function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

/**
 * Garde-fou d'accès aux données : chaque handler métier exige une session
 * authentifiée. Centraliser ici évite d'oublier une route.
 */
function authorizedDatabase() {
  requireAuthenticated();

  return getDatabase();
}

export function registerIpc(): void {
  /* ---------------------------------------------------------------------- */
  /* Authentification (accessible sans session)                             */
  /* ---------------------------------------------------------------------- */

  ipcMain.handle("auth:accounts", () => listAccounts());

  ipcMain.handle(
    "auth:login",
    (_event: IpcMainInvokeEvent, userId: number, password: string) =>
      login(userId, password),
  );

  ipcMain.handle("auth:logout", () => logout());

  ipcMain.handle("auth:state", () => getAuthState());

  ipcMain.handle(
    "auth:change-password",
    (_event: IpcMainInvokeEvent, currentPassword: string, newPassword: string) =>
      changePassword(currentPassword, newPassword),
  );

  /* ---------------------------------------------------------------------- */
  /* Données (session requise)                                              */
  /* ---------------------------------------------------------------------- */

  ipcMain.handle("classes:list", () => listClasses(authorizedDatabase()));

  ipcMain.handle(
    "students:list",
    (_event: IpcMainInvokeEvent, query: StudentQuery | undefined) =>
      listStudents(authorizedDatabase(), query ?? {}),
  );

  ipcMain.handle(
    "students:page",
    (_event: IpcMainInvokeEvent, query: StudentQuery | undefined) => {
      const { limit, offset } = query ?? {};

      // Bornes défensives : l'interface peut demander n'importe quoi.
      const safeLimit = Math.min(Math.max(Math.trunc(limit ?? 50), 1), 500);
      const safeOffset = Math.max(Math.trunc(offset ?? 0), 0);

      return listStudentsPage(authorizedDatabase(), query ?? {}, {
        limit: safeLimit,
        offset: safeOffset,
      });
    },
  );

  ipcMain.handle("students:get", (_event: IpcMainInvokeEvent, id: number) =>
    getStudent(authorizedDatabase(), id),
  );

  ipcMain.handle(
    "students:recent",
    (_event: IpcMainInvokeEvent, limit: number | undefined) =>
      listRecentStudents(authorizedDatabase(), limit ?? 8),
  );

  ipcMain.handle(
    "students:create",
    (_event: IpcMainInvokeEvent, input: StudentInput) =>
      createStudent(authorizedDatabase(), input),
  );

  ipcMain.handle(
    "students:update",
    (_event: IpcMainInvokeEvent, id: number, input: StudentInput) =>
      updateStudent(authorizedDatabase(), id, input),
  );

  ipcMain.handle("students:delete", (_event: IpcMainInvokeEvent, id: number) =>
    deleteStudent(authorizedDatabase(), id),
  );

  ipcMain.handle(
    "students:audit",
    (_event: IpcMainInvokeEvent, id: number, limit: number | undefined) =>
      listAuditForStudent(authorizedDatabase(), id, limit ?? 20),
  );

  ipcMain.handle(
    "file:save-pdf",
    async (_event: IpcMainInvokeEvent, filename: string, data: ArrayBuffer) => {
      requireAuthenticated();

      const target = await uniquePath(
        app.getPath("downloads"),
        basename(filename || "export.pdf"),
      );

      await writeFile(target, Buffer.from(data));

      return target;
    },
  );

  /* ---------------------------------------------------------------------- */
  /* Sauvegarde / restauration                                              */
  /* ---------------------------------------------------------------------- */

  ipcMain.handle("backup:list", () => {
    requireAuthenticated();

    return listBackups();
  });

  ipcMain.handle("backup:create", () => {
    requireAuthenticated();

    return createBackup();
  });

  ipcMain.handle("backup:export", async (event: IpcMainInvokeEvent) => {
    requireAuthenticated();

    const window = windowFromEvent(event);
    const suggested = `schoolcare-sauvegarde-${new Date()
      .toISOString()
      .slice(0, 10)}.db`;

    const result = await dialog.showSaveDialog(window!, {
      title: "Enregistrer une sauvegarde",
      defaultPath: join(app.getPath("documents"), suggested),
      filters: [{ name: "Base SchoolCare", extensions: ["db"] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return exportBackupTo(result.filePath);
  });

  ipcMain.handle(
    "backup:restore",
    async (event: IpcMainInvokeEvent): Promise<RestoreResult> => {
      requireAuthenticated();

      const window = windowFromEvent(event);

      const picked = await dialog.showOpenDialog(window!, {
        title: "Choisir une sauvegarde à restaurer",
        properties: ["openFile"],
        filters: [{ name: "Base SchoolCare", extensions: ["db"] }],
      });

      if (picked.canceled || picked.filePaths.length === 0) {
        return { status: "cancelled" };
      }

      const source = picked.filePaths[0];
      const inspection = await inspectBackupFile(source);

      if (!inspection.ok) {
        dialog.showErrorBox(
          "Sauvegarde illisible",
          `${inspection.reason}\n\nAucune donnée n'a été modifiée.`,
        );

        return { status: "invalid", reason: inspection.reason };
      }

      const confirmation = await dialog.showMessageBox(window!, {
        type: "warning",
        buttons: ["Annuler", "Restaurer et redémarrer"],
        defaultId: 1,
        cancelId: 0,
        title: "Restaurer cette sauvegarde ?",
        message: "Les données actuelles seront remplacées.",
        detail: [
          `Sauvegarde choisie : ${basename(source)}`,
          `Contenu : ${inspection.students} élève(s), ${inspection.classes} classe(s).`,
          "",
          "Une copie de sécurité de la base actuelle est créée avant le",
          "remplacement. L'application va redémarrer pour charger les données",
          "restaurées.",
        ].join("\n"),
      });

      if (confirmation.response !== 1) {
        return { status: "cancelled" };
      }

      // La base doit être fermée (checkpoint du WAL) avant d'être remplacée.
      closeDatabase();

      const { safetyCopy } = await replaceDatabaseWith(source);

      dialog.showMessageBox(window!, {
        type: "info",
        buttons: ["Redémarrer"],
        title: "Restauration effectuée",
        message: "Les données ont été restaurées.",
        detail: [
          `Copie de sécurité de l'ancienne base : ${safetyCopy}`,
          "",
          "L'application va redémarrer.",
        ].join("\n"),
      });

      app.relaunch();
      app.exit(0);

      return { status: "restored", safetyCopy };
    },
  );
}
