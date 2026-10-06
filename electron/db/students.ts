import type { DatabaseSync } from "node:sqlite";
import type {
  ClassRoom,
  Student,
  StudentQuery,
} from "../../src/types/models.js";

type ClassRow = {
  id: number;
  name: string;
  level: string;
  academic_year: string;
};

type StudentRow = {
  id: number;
  matricule: string;
  last_name: string;
  first_name: string;
  gender: string;
  birth_date: string | null;
  class_id: number | null;
  class_name: string | null;
  status: string;
};

export function listClasses(database: DatabaseSync): ClassRoom[] {
  const rows = database
    .prepare(
      "SELECT id, name, level, academic_year FROM classes ORDER BY name",
    )
    .all() as ClassRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    academicYear: row.academic_year,
  }));
}

type Param = string | number;

function pushIn(
  conditions: string[],
  params: Param[],
  column: string,
  values: readonly Param[] | undefined,
): void {
  if (!values || values.length === 0) {
    return;
  }

  conditions.push(`${column} IN (${values.map(() => "?").join(", ")})`);
  params.push(...values);
}

export function listStudents(
  database: DatabaseSync,
  query: StudentQuery,
): Student[] {
  const conditions: string[] = [];
  const params: Param[] = [];

  pushIn(conditions, params, "s.class_id", query.classIds);
  pushIn(conditions, params, "s.status", query.statuses);
  pushIn(conditions, params, "s.gender", query.genders);

  const search = query.search?.trim();

  if (search) {
    conditions.push(
      "(s.last_name LIKE ? OR s.first_name LIKE ? OR s.matricule LIKE ?)",
    );
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = database
    .prepare(
      `SELECT s.id, s.matricule, s.last_name, s.first_name, s.gender,
              s.birth_date, s.class_id, c.name AS class_name, s.status
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
         ${where}
        ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`,
    )
    .all(...params) as StudentRow[];

  return rows.map((row) => ({
    id: row.id,
    matricule: row.matricule,
    lastName: row.last_name,
    firstName: row.first_name,
    gender: row.gender === "F" ? "F" : "M",
    birthDate: row.birth_date,
    classId: row.class_id,
    className: row.class_name,
    status: row.status === "inactive" ? "inactive" : "active",
  }));
}
