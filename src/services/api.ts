import type { ClassRoom, Student, StudentQuery } from "../types/models";

export function listClasses(): Promise<ClassRoom[]> {
  return window.schoolCare.listClasses();
}

export function listStudents(query?: StudentQuery): Promise<Student[]> {
  return window.schoolCare.listStudents(query);
}

export function savePdfFile(
  filename: string,
  data: ArrayBuffer,
): Promise<string | null> {
  return window.schoolCare.savePdf(filename, data);
}
