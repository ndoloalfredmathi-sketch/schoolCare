import type {
  AccountOption,
  AuditEntry,
  AuthState,
  BackupInfo,
  ClassRoom,
  RestoreResult,
  Student,
  StudentInput,
  StudentPage,
  StudentQuery,
} from "../types/models";

export function listAccounts(): Promise<AccountOption[]> {
  return window.schoolCare.listAccounts();
}

export function login(userId: number, password: string): Promise<AuthState> {
  return window.schoolCare.login(userId, password);
}

export function logout(): Promise<AuthState> {
  return window.schoolCare.logout();
}

export function getAuthState(): Promise<AuthState> {
  return window.schoolCare.getAuthState();
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthState> {
  return window.schoolCare.changePassword(currentPassword, newPassword);
}

export function listClasses(): Promise<ClassRoom[]> {
  return window.schoolCare.listClasses();
}

export function listStudents(query?: StudentQuery): Promise<Student[]> {
  return window.schoolCare.listStudents(query);
}

/** Page d'élèves : la liste n'est jamais chargée entièrement en mémoire. */
export function listStudentsPage(query?: StudentQuery): Promise<StudentPage> {
  return window.schoolCare.listStudentsPage(query);
}

export function getStudent(id: number): Promise<Student | null> {
  return window.schoolCare.getStudent(id);
}

export function listRecentStudents(limit?: number): Promise<Student[]> {
  return window.schoolCare.listRecentStudents(limit);
}

export function createStudent(input: StudentInput): Promise<Student> {
  return window.schoolCare.createStudent(input);
}

export function updateStudent(
  id: number,
  input: StudentInput,
): Promise<Student> {
  return window.schoolCare.updateStudent(id, input);
}

export function deleteStudent(id: number): Promise<Student> {
  return window.schoolCare.deleteStudent(id);
}

export function listStudentAudit(
  id: number,
  limit?: number,
): Promise<AuditEntry[]> {
  return window.schoolCare.listStudentAudit(id, limit);
}

export function listBackups(): Promise<BackupInfo[]> {
  return window.schoolCare.listBackups();
}

export function createBackup(): Promise<BackupInfo> {
  return window.schoolCare.createBackup();
}

export function exportBackup(): Promise<BackupInfo | null> {
  return window.schoolCare.exportBackup();
}

export function restoreBackup(): Promise<RestoreResult> {
  return window.schoolCare.restoreBackup();
}

export function savePdfFile(
  filename: string,
  data: ArrayBuffer,
): Promise<string | null> {
  return window.schoolCare.savePdf(filename, data);
}
