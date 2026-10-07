import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpc } from "./ipc.js";
import { closeDatabase, getDatabase } from "./db/index.js";
import { runDailyBackup } from "./db/backup.js";

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Politique de sécurité du contenu.
 *
 * En production, tout est servi depuis le paquet local : on interdit donc toute
 * origine distante. `wasm-unsafe-eval` et `unsafe-inline` pour les styles sont
 * requis par react-pdf, qui applique ses styles en ligne dans un canevas.
 *
 * En développement, Vite a besoin de ses websockets de rechargement et de ses
 * styles injectés à la volée.
 */
function applyContentSecurityPolicy(): void {
  const policy = devServerUrl
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' ws: http:",
        "worker-src 'self' blob:",
      ]
    : [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' blob: data:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ];

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy.join("; ")],
      },
    });
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    show: true,
    transparent: true,
    backgroundColor: "#00000000",
  });

  if (devServerUrl) {
    // Ne jamais concaténer l'URL du serveur de dev : `base: "./"` la fait
    // ressembler à "http://localhost:5173./" et le splash ne se chargerait pas.
    splashWindow.loadURL(new URL("splash.html", devServerUrl).toString());
  } else {
    splashWindow.loadFile(path.join(app.getAppPath(), "dist", "splash.html"));
  }

  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    title: "SchoolCare",
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.setMenu(null);

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow.center();

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized-changed", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized-changed", false);
  });

  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      splashWindow?.close();
      splashWindow = null;
      mainWindow?.show();
    }, 800);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.on("window-minimize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  window?.minimize();
});

ipcMain.on("window-maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return;
  }

  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
});

ipcMain.on("window-close", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  window?.close();
});

ipcMain.handle("window-is-maximized", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  return window?.isMaximized() ?? false;
});

/**
 * Ouvre la base avant toute fenêtre : si elle est inaccessible, l'utilisateur
 * doit voir une explication au lieu d'une application vide sans message.
 */
function startDatabase(): boolean {
  try {
    getDatabase();
    return true;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);

    console.error("Ouverture de la base impossible:", cause);
    dialog.showErrorBox(
      "SchoolCare — démarrage impossible",
      [
        "La base de données n'a pas pu être ouverte.",
        "",
        detail,
        "",
        "Vérifiez que le dossier de données est accessible et dispose d'espace",
        "disque, puis relancez l'application. Une restauration depuis une",
        "sauvegarde peut aussi être nécessaire.",
      ].join("\n"),
    );

    return false;
  }
}

// Une seule instance : deux processus écrivant dans le même fichier SQLite
// finissent par le corrompre.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (!startDatabase()) {
      app.exit(1);
      return;
    }

    registerIpc();
    applyContentSecurityPolicy();
    createSplashWindow();
    createMainWindow();

    // Après l'affichage : la sauvegarde ne doit pas retarder le démarrage.
    void runDailyBackup().then((created) => {
      if (created) {
        console.log("Sauvegarde automatique créée :", created.path);
      }
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("will-quit", () => {
    // Checkpoint du WAL puis fermeture : évite un fichier -wal orphelin.
    closeDatabase();
  });
}
