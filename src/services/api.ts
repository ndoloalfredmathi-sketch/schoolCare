import type {
  ClassRoom,
  Student,
  StudentInput,
  StudentQuery,
} from "../types/models";

export function listClasses(): Promise<ClassRoom[]> {
  return window.schoolCare.listClasses();
}

export function listStudents(query?: StudentQuery): Promise<Student[]> {
  return window.schoolCare.listStudents(query);
}

export function listRecentStudents(limit?: number): Promise<Student[]> {
  return window.schoolCare.listRecentStudents(limit);
}

export function createStudent(input: StudentInput): Promise<Student> {
  return window.schoolCare.createStudent(input);
}

export function savePdfFile(
  filename: string,
  data: ArrayBuffer,
): Promise<string | null> {
  return window.schoolCare.savePdf(filename, data);
}
