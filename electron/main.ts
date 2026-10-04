import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    roundedCorners: false,
  });

  if (isDevelopment) {
    splashWindow.loadURL("http://localhost:5173/splash.html");
  } else {
    splashWindow.loadFile(
      path.join(app.getAppPath(), "dist", "splash.html")
    );
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

  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist", "index.html")
    );
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
      mainWindow?.show();
    }, 800);
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

app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
