export type Gender = "F" | "M";

export type StudentStatus = "active" | "inactive";

export type ClassRoom = {
  id: number;
  name: string;
  level: string;
  academicYear: string;
};

export type Student = {
  id: number;
  matricule: string;
  lastName: string;
  firstName: string;
  gender: Gender;
  birthDate: string | null;
  classId: number | null;
  className: string | null;
  status: StudentStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StudentInput = {
  lastName: string;
  firstName: string;
  gender: Gender;
  birthDate: string | null;
  classId: number;
};

export type StudentQuery = {
  search?: string;
  classIds?: number[];
  statuses?: StudentStatus[];
  genders?: Gender[];
  /** Nombre maximum de lignes à renvoyer. Absent = toutes les lignes. */
  limit?: number;
  /** Décalage de la première ligne renvoyée. */
  offset?: number;
};

export type StudentPage = {
  rows: Student[];
  /** Nombre de lignes effectivement renvoyées. */
  count: number;
  /** Nombre total de lignes correspondant au filtre, toutes pages confondues. */
  total: number;
  limit: number;
  offset: number;
};

/** Tailles de page proposées dans l'interface. */
export const PAGE_SIZES = [25, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 50;

export type AuditEntry = {
  id: number;
  entityId: number;
  action: string;
  actor: string;
  payload: unknown;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* Absences                                                                   */
/* -------------------------------------------------------------------------- */

/** Demi-journée concernée par une absence. `full` couvre la journée entière. */
export type AbsencePeriod = "full" | "am" | "pm";

export const ABSENCE_PERIODS: AbsencePeriod[] = ["full", "am", "pm"];

export const ABSENCE_PERIOD_LABELS: Record<AbsencePeriod, string> = {
  full: "Journée",
  am: "Matin",
  pm: "Après-midi",
};

export type Absence = {
  id: number;
  studentId: number;
  matricule: string;
  lastName: string;
  firstName: string;
  classId: number | null;
  className: string | null;
  /** Format AAAA-MM-JJ. */
  date: string;
  period: AbsencePeriod;
  justified: boolean;
  reason: string | null;
  recordedBy: string;
  createdAt: string;
};

export type AbsenceInput = {
  studentId: number;
  date: string;
  period: AbsencePeriod;
  justified: boolean;
  reason: string | null;
};

export type AbsenceQuery = {
  studentId?: number;
  classIds?: number[];
  /** Borne inclusive au format AAAA-MM-JJ. */
  from?: string;
  to?: string;
  justified?: boolean;
  limit?: number;
  offset?: number;
};

/** Ligne de la saisie rapide : un élève et les demi-journées déjà marquées. */
export type AttendanceRow = {
  studentId: number;
  matricule: string;
  lastName: string;
  firstName: string;
  classId: number | null;
  className: string | null;
  periods: AbsencePeriod[];
  justified: boolean;
  reason: string | null;
};

export type AbsenceSummary = {
  studentId: number;
  /** Nombre d'enregistrements, une journée comptant pour une ligne. */
  total: number;
  /** Nombre de demi-journées : une journée vaut 2. */
  halfDays: number;
  justified: number;
  unjustified: number;
};

export type BackupInfo = {
  fileName: string;
  path: string;
  size: number;
  modifiedAt: string;
};

export type RestoreResult =
  | { status: "cancelled" }
  | { status: "invalid"; reason: string }
  | { status: "restored"; safetyCopy: string };

export type RoleKey = "admin" | "teacher" | "parent" | "student";

export type AuthUser = {
  id: number;
  displayName: string;
  email: string | null;
  role: RoleKey;
  mustChangePassword: boolean;
};

export type AccountOption = {
  id: number;
  displayName: string;
  role: RoleKey;
};

export type AuthState = {
  authenticated: boolean;
  user: AuthUser | null;
};

export type SchoolCareApi = {
  listClasses: () => Promise<ClassRoom[]>;
  listStudents: (query?: StudentQuery) => Promise<Student[]>;
  listStudentsPage: (query?: StudentQuery) => Promise<StudentPage>;
  getStudent: (id: number) => Promise<Student | null>;
  listRecentStudents: (limit?: number) => Promise<Student[]>;
  createStudent: (input: StudentInput) => Promise<Student>;
  updateStudent: (id: number, input: StudentInput) => Promise<Student>;
  deleteStudent: (id: number) => Promise<Student>;
  listStudentAudit: (id: number, limit?: number) => Promise<AuditEntry[]>;
  listAbsences: (query?: AbsenceQuery) => Promise<Absence[]>;
  countAbsences: (query?: AbsenceQuery) => Promise<number>;
  listAttendance: (classId: number, date: string) => Promise<AttendanceRow[]>;
  getAbsenceSummary: (studentId: number) => Promise<AbsenceSummary>;
  createAbsence: (input: AbsenceInput) => Promise<Absence>;
  updateAbsence: (id: number, input: AbsenceInput) => Promise<Absence>;
  deleteAbsence: (id: number) => Promise<Absence>;
  toggleAbsence: (
    input: AbsenceInput,
  ) => Promise<{ absent: boolean; absenceId: number | null }>;
  listBackups: () => Promise<BackupInfo[]>;
  createBackup: () => Promise<BackupInfo>;
  exportBackup: () => Promise<BackupInfo | null>;
  restoreBackup: () => Promise<RestoreResult>;
  listAccounts: () => Promise<AccountOption[]>;
  login: (userId: number, password: string) => Promise<AuthState>;
  logout: () => Promise<AuthState>;
  getAuthState: () => Promise<AuthState>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<AuthState>;
  savePdf: (filename: string, data: ArrayBuffer) => Promise<string | null>;
};
