import { contextBridge, ipcRenderer } from "electron";
import type {
  SchoolCareApi,
  StudentInput,
  StudentQuery,
} from "../src/types/models.js";

const schoolCare: SchoolCareApi = {
  listClasses: () => ipcRenderer.invoke("classes:list"),
  listStudents: (query?: StudentQuery) =>
    ipcRenderer.invoke("students:list", query),
  listRecentStudents: (limit?: number) =>
    ipcRenderer.invoke("students:recent", limit),
  createStudent: (input: StudentInput) =>
    ipcRenderer.invoke("students:create", input),
  savePdf: (filename: string, data: ArrayBuffer) =>
    ipcRenderer.invoke("file:save-pdf", filename, data),
};

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

contextBridge.exposeInMainWorld("schoolCare", schoolCare);
