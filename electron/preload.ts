import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  AbsenceInput,
  AbsenceQuery,
  SchoolCareApi,
  StudentInput,
  StudentQuery,
} from "../src/types/models.js";

const schoolCare: SchoolCareApi = {
  listAccounts: () => ipcRenderer.invoke("auth:accounts"),
  login: (userId: number, password: string) =>
    ipcRenderer.invoke("auth:login", userId, password),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getAuthState: () => ipcRenderer.invoke("auth:state"),
  changePassword: (currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke("auth:change-password", currentPassword, newPassword),
  listClasses: () => ipcRenderer.invoke("classes:list"),
  listStudents: (query?: StudentQuery) =>
    ipcRenderer.invoke("students:list", query),
  listStudentsPage: (query?: StudentQuery) =>
    ipcRenderer.invoke("students:page", query),
  getStudent: (id: number) => ipcRenderer.invoke("students:get", id),
  listRecentStudents: (limit?: number) =>
    ipcRenderer.invoke("students:recent", limit),
  createStudent: (input: StudentInput) =>
    ipcRenderer.invoke("students:create", input),
  updateStudent: (id: number, input: StudentInput) =>
    ipcRenderer.invoke("students:update", id, input),
  deleteStudent: (id: number) => ipcRenderer.invoke("students:delete", id),
  listStudentAudit: (id: number, limit?: number) =>
    ipcRenderer.invoke("students:audit", id, limit),
  listAbsences: (query?: AbsenceQuery) =>
    ipcRenderer.invoke("absences:list", query),
  countAbsences: (query?: AbsenceQuery) =>
    ipcRenderer.invoke("absences:count", query),
  listAttendance: (classId: number, date: string) =>
    ipcRenderer.invoke("absences:attendance", classId, date),
  getAbsenceSummary: (studentId: number) =>
    ipcRenderer.invoke("absences:summary", studentId),
  createAbsence: (input: AbsenceInput) =>
    ipcRenderer.invoke("absences:create", input),
  updateAbsence: (id: number, input: AbsenceInput) =>
    ipcRenderer.invoke("absences:update", id, input),
  deleteAbsence: (id: number) => ipcRenderer.invoke("absences:delete", id),
  toggleAbsence: (input: AbsenceInput) =>
    ipcRenderer.invoke("absences:toggle", input),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  createBackup: () => ipcRenderer.invoke("backup:create"),
  exportBackup: () => ipcRenderer.invoke("backup:export"),
  restoreBackup: () => ipcRenderer.invoke("backup:restore"),
  savePdf: (filename: string, data: ArrayBuffer) =>
    ipcRenderer.invoke("file:save-pdf", filename, data),
};

contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean) =>
      callback(maximized);

    ipcRenderer.on("window-maximized-changed", listener);

    return () => ipcRenderer.removeListener("window-maximized-changed", listener);
  },
});

contextBridge.exposeInMainWorld("schoolCare", schoolCare);
