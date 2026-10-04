import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: unknown, maximized: boolean) => callback(maximized);

    ipcRenderer.on("window-maximized-changed", listener);

    return () => ipcRenderer.removeListener("window-maximized-changed", listener);
  },
});
