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
};

export type RoleKey = "admin" | "teacher" | "parent" | "student";

export type SchoolCareApi = {
  listClasses: () => Promise<ClassRoom[]>;
  listStudents: (query?: StudentQuery) => Promise<Student[]>;
  listRecentStudents: (limit?: number) => Promise<Student[]>;
  createStudent: (input: StudentInput) => Promise<Student>;
  savePdf: (filename: string, data: ArrayBuffer) => Promise<string | null>;
};
