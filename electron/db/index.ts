import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getUserDataPath, isPackaged } from "../runtime.js";
import { migrate } from "./migrations.js";
import { seedDemoData } from "./seed.js";

let database: DatabaseSync | null = null;

/** Chemin du fichier de base de données dans le dossier utilisateur. */
export function getDatabasePath(): string {
  return path.join(getUserDataPath(), "schoolcare.db");
}

/**
 * Ouvre (et migre) la base. Une seconde ouverture dans la même session renvoie
 * la connexion existante.
 */
export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const file = getDatabasePath();

  // Un délai d'attente évite un "database is locked" immédiat si un autre
  // processus (sauvegarde, antivirus) tient brièvement le fichier.
  const connection = new DatabaseSync(file, { timeout: 5000 });

  // WAL : lectures concurrentes pendant une écriture, et bien meilleure
  // résistance à une fermeture brutale.
  connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA foreign_keys = ON");

  const version = migrate(connection);
  console.log(`Base ouverte (schéma v${version}) : ${file}`);

  if (!isPackaged()) {
    try {
      seedDemoData(connection);
    } catch (cause) {
      console.error("Échec du seed de démonstration:", cause);
    }
  }

  database = connection;

  return database;
}

/** Ferme proprement la base (checkpoint WAL puis close). */
export function closeDatabase(): void {
  if (!database) {
    return;
  }

  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (cause) {
    console.error("Checkpoint WAL échoué:", cause);
  }

  try {
    database.close();
  } catch (cause) {
    console.error("Fermeture de la base échouée:", cause);
  }

  database = null;
}
