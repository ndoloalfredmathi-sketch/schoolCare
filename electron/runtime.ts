import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Environnement d'exécution du processus principal.
 *
 * Electron expose `app` ; en dehors d'Electron (tests automatisés exécutés par
 * Node), on retombe sur les emplacements standard de chaque système et sur
 * `SCHOOLCARE_USER_DATA`, ce qui permet d'isoler complètement les données.
 */
type ElectronEnvironment = {
  getPath: (name: string) => string;
  isPackaged: boolean;
};

/**
 * `require` est absent des modules ES : on le reconstruit. L'appel est
 * volontairement paresseux — sous Node, le module `electron` n'expose pas
 * `app` et l'import doit simplement échouer sans conséquence.
 */
function electronApp(): ElectronEnvironment | null {
  try {
    const require = createRequire(import.meta.url);
    const electron = require("electron") as { app?: ElectronEnvironment };

    return typeof electron?.app?.getPath === "function" ? electron.app : null;
  } catch {
    return null;
  }
}

/** Emplacement par défaut du dossier de données, par système. */
function defaultUserDataPath(): string {
  const home = os.homedir();

  switch (process.platform) {
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        "SchoolCare",
      );
    case "darwin":
      return path.join(home, "Library", "Application Support", "SchoolCare");
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
        "SchoolCare",
      );
  }
}

export function getUserDataPath(): string {
  const override = process.env.SCHOOLCARE_USER_DATA;

  if (override) {
    return override;
  }

  return electronApp()?.getPath("userData") ?? defaultUserDataPath();
}

/** Vrai uniquement dans une application Electron empaquetée. */
export function isPackaged(): boolean {
  return electronApp()?.isPackaged ?? false;
}
