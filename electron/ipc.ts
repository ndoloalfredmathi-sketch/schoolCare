import { app, ipcMain } from "electron";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { StudentInput, StudentQuery } from "../src/types/models.js";
import { getDatabase } from "./db/index.js";
import {
  createStudent,
  listClasses,
  listRecentStudents,
  listStudents,
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

export function registerIpc(): void {
  ipcMain.handle("classes:list", () => listClasses(getDatabase()));

  ipcMain.handle(
    "students:list",
    (_event: unknown, query: StudentQuery | undefined) =>
      listStudents(getDatabase(), query ?? {}),
  );

  ipcMain.handle(
    "students:recent",
    (_event: unknown, limit: number | undefined) =>
      listRecentStudents(getDatabase(), limit ?? 8),
  );

  ipcMain.handle("students:create", (_event: unknown, input: StudentInput) =>
    createStudent(getDatabase(), input),
  );

  ipcMain.handle(
    "file:save-pdf",
    async (_event: unknown, filename: string, data: ArrayBuffer) => {
      const target = await uniquePath(
        app.getPath("downloads"),
        basename(filename || "export.pdf"),
      );

      await writeFile(target, Buffer.from(data));

      return target;
    },
  );
}
