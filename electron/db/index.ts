import { app } from "electron";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA } from "./schema.js";
import { seedDemoData } from "./seed.js";

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const file = path.join(app.getPath("userData"), "schoolcare.db");
  const connection = new DatabaseSync(file);

  connection.exec(SCHEMA);

  if (!app.isPackaged) {
    try {
      seedDemoData(connection);
    } catch (cause) {
      console.error("Échec du seed de démonstration:", cause);
    }
  }

  database = connection;

  return database;
}
