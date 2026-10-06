import type { DatabaseSync } from "node:sqlite";
import type {
  ClassRoom,
  Student,
  StudentInput,
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
  created_at: string | null;
};

const STUDENT_SELECT = `SELECT s.id, s.matricule, s.last_name, s.first_name, s.gender,
              s.birth_date, s.class_id, c.name AS class_name, s.status, s.created_at
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id`;

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    matricule: row.matricule,
    lastName: row.last_name,
    firstName: row.first_name,
    gender: row.gender === "F" ? "F" : "M",
    birthDate: row.birth_date,
    classId: row.class_id,
    className: row.class_name,
    status: row.status === "inactive" ? "inactive" : "active",
    createdAt: row.created_at,
  };
}

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
      `${STUDENT_SELECT}
         ${where}
        ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`,
    )
    .all(...params) as StudentRow[];

  return rows.map(mapStudent);
}

function sequenceOf(matricule: string, prefix: string): number {
  const sequence = Number.parseInt(matricule.slice(prefix.length), 10);

  return Number.isFinite(sequence) ? sequence : 0;
}

function nextMatricule(database: DatabaseSync): string {
  const prefix = `SC-${new Date().getFullYear()}-`;
  const rows = database
    .prepare("SELECT matricule FROM students WHERE matricule LIKE ?")
    .all(`${prefix}%`) as { matricule: string }[];

  let sequence = rows.reduce(
    (max, row) => Math.max(max, sequenceOf(row.matricule, prefix)),
    0,
  );

  let candidate = `${prefix}${String(sequence + 1).padStart(4, "0")}`;
  const taken = database.prepare(
    "SELECT 1 FROM students WHERE matricule = ?",
  );

  while (taken.get(candidate)) {
    sequence += 1;
    candidate = `${prefix}${String(sequence).padStart(4, "0")}`;
  }

  return candidate;
}

export function createStudent(
  database: DatabaseSync,
  input: StudentInput,
): Student {
  const lastName = input.lastName.trim();
  const firstName = input.firstName.trim();

  if (!lastName || !firstName) {
    throw new Error("Le nom et le prénom sont obligatoires.");
  }

  if (input.gender !== "F" && input.gender !== "M") {
    throw new Error("Le sexe est obligatoire.");
  }

  const classroom = database
    .prepare("SELECT id, name FROM classes WHERE id = ?")
    .get(input.classId) as ClassRow | undefined;

  if (!classroom) {
    throw new Error("La classe sélectionnée n'existe pas.");
  }

  const birthDate = input.birthDate ? input.birthDate.trim() : "";

  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("La date de naissance est invalide.");
  }

  const matricule = nextMatricule(database);

  const info = database
    .prepare(
      `INSERT INTO students (matricule, last_name, first_name, gender, birth_date, class_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    )
    .run(
      matricule,
      lastName,
      firstName,
      input.gender,
      birthDate || null,
      input.classId,
    );

  const row = database
    .prepare(`${STUDENT_SELECT} WHERE s.id = ?`)
    .get(Number(info.lastInsertRowid)) as StudentRow | undefined;

  if (!row) {
    throw new Error("L'inscription a échoué.");
  }

  return mapStudent(row);
}

export function listRecentStudents(
  database: DatabaseSync,
  limit: number,
): Student[] {
  const rows = database
    .prepare(`${STUDENT_SELECT} ORDER BY s.created_at DESC, s.id DESC LIMIT ?`)
    .all(limit) as StudentRow[];

  return rows.map(mapStudent);
}
