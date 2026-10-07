import type { DatabaseSync } from "node:sqlite";
import { currentActor } from "../auth/session.js";
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
  updated_at: string | null;
};

const STUDENT_SELECT = `SELECT s.id, s.matricule, s.last_name, s.first_name, s.gender,
              s.birth_date, s.class_id, c.name AS class_name, s.status,
              s.created_at, s.updated_at
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
    updatedAt: row.updated_at,
  };
}

export function listClasses(database: DatabaseSync): ClassRoom[] {
  const rows = database
    .prepare("SELECT id, name, level, academic_year FROM classes ORDER BY name")
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

/**
 * Construit la clause WHERE commune à la liste et au comptage.
 *
 * Sans `class_name`, un élève sans classe n'apparaît pas dans un filtre par
 * nom de classe — le comptage et la liste restent néanmoins toujours cohérents
 * puisqu'ils partagent ces mêmes conditions.
 */
function buildStudentFilter(query: StudentQuery): {
  where: string;
  params: Param[];
} {
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

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/** Nombre total d'élèves correspondant au filtre, sans charger les lignes. */
export function countStudents(
  database: DatabaseSync,
  query: StudentQuery,
): number {
  const { where, params } = buildStudentFilter(query);

  const row = database
    .prepare(`SELECT COUNT(*) AS total FROM students s ${where}`)
    .get(...params) as { total: number };

  return row.total;
}

export type StudentPageOptions = {
  limit: number;
  offset: number;
};

export type StudentPage = {
  rows: Student[];
  /** Nombre de lignes renvoyées. */
  count: number;
  /** Nombre total de lignes correspondant au filtre, toutes pages confondues. */
  total: number;
  limit: number;
  offset: number;
};

/** Page d'élèves, triée par nom puis prénom. */
export function listStudentsPage(
  database: DatabaseSync,
  query: StudentQuery,
  options: StudentPageOptions,
): StudentPage {
  const { where, params } = buildStudentFilter(query);
  const total = countStudents(database, query);

  const rows = database
    .prepare(
      `${STUDENT_SELECT}
         ${where}
        ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE
        LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as StudentRow[];

  return {
    rows: rows.map(mapStudent),
    count: rows.length,
    total,
    limit: options.limit,
    offset: options.offset,
  };
}

export function listStudents(
  database: DatabaseSync,
  query: StudentQuery,
): Student[] {
  const { where, params } = buildStudentFilter(query);

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

export function getStudent(database: DatabaseSync, id: number): Student | null {
  const row = database
    .prepare(`${STUDENT_SELECT} WHERE s.id = ?`)
    .get(id) as StudentRow | undefined;

  return row ? mapStudent(row) : null;
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

/* -------------------------------------------------------------------------- */
/* Journal d'audit                                                            */
/* -------------------------------------------------------------------------- */

/** Acteur par défaut : l'utilisateur connecté, pour que l'audit soit nominatif. */
function defaultActor(): string {
  return currentActor();
}

function writeAudit(
  database: DatabaseSync,
  entityId: number,
  action: "create" | "update" | "delete",
  payload: unknown,
  actor: string,
): void {
  database
    .prepare(
      `INSERT INTO audit_log (entity, entity_id, action, actor, payload)
       VALUES ('student', ?, ?, ?, ?)`,
    )
    .run(entityId, action, actor, JSON.stringify(payload));
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Vérifie que la date est au format AAAA-MM-JJ et correspond à un jour réel. */
function isValidDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function assertClassExists(database: DatabaseSync, classId: unknown): number {
  if (typeof classId !== "number" || !Number.isInteger(classId)) {
    throw new Error("La classe est obligatoire.");
  }

  const classroom = database
    .prepare("SELECT id FROM classes WHERE id = ?")
    .get(classId);

  if (!classroom) {
    throw new Error("La classe sélectionnée n'existe pas.");
  }

  return classId;
}

type ValidatedFields = {
  lastName: string;
  firstName: string;
  gender: "F" | "M";
  birthDate: string | null;
  classId: number;
};

function validateInput(
  database: DatabaseSync,
  input: StudentInput,
): ValidatedFields {
  const lastName = input.lastName.trim();
  const firstName = input.firstName.trim();

  if (!lastName || !firstName) {
    throw new Error("Le nom et le prénom sont obligatoires.");
  }

  if (input.gender !== "F" && input.gender !== "M") {
    throw new Error("Le sexe est obligatoire.");
  }

  const classId = assertClassExists(database, input.classId);
  const birthDate = input.birthDate?.trim() ?? "";

  if (birthDate && !BIRTH_DATE_PATTERN.test(birthDate)) {
    throw new Error("La date de naissance est invalide.");
  }

  if (birthDate && !isValidDate(birthDate)) {
    throw new Error("La date de naissance n'existe pas dans le calendrier.");
  }

  return {
    lastName,
    firstName,
    gender: input.gender,
    birthDate: birthDate || null,
    classId,
  };
}

function readStudentOrThrow(database: DatabaseSync, id: number): Student {
  const student = getStudent(database, id);

  if (!student) {
    throw new Error("Cet élève n'existe pas.");
  }

  return student;
}

/** Photographie minimale utilisée par le journal d'audit. */
function snapshot(student: Student) {
  return {
    matricule: student.matricule,
    lastName: student.lastName,
    firstName: student.firstName,
    gender: student.gender,
    birthDate: student.birthDate,
    classId: student.classId,
    className: student.className,
    status: student.status,
  };
}

/* -------------------------------------------------------------------------- */
/* Écritures                                                                  */
/* -------------------------------------------------------------------------- */

export function createStudent(
  database: DatabaseSync,
  input: StudentInput,
  actor: string = defaultActor(),
): Student {
  const fields = validateInput(database, input);
  const matricule = nextMatricule(database);

  database.exec("BEGIN");

  try {
    const info = database
      .prepare(
        `INSERT INTO students
           (matricule, last_name, first_name, gender, birth_date, class_id, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', strftime('%Y-%m-%d %H:%M:%f','now'))`,
      )
      .run(
        matricule,
        fields.lastName,
        fields.firstName,
        fields.gender,
        fields.birthDate,
        fields.classId,
      );

    const created = readStudentOrThrow(database, Number(info.lastInsertRowid));

    writeAudit(database, created.id, "create", snapshot(created), actor);
    database.exec("COMMIT");

    return created;
  } catch (cause) {
    database.exec("ROLLBACK");
    throw cause;
  }
}

export function updateStudent(
  database: DatabaseSync,
  id: number,
  input: StudentInput,
  actor: string = defaultActor(),
): Student {
  const before = readStudentOrThrow(database, id);
  const fields = validateInput(database, input);

  database.exec("BEGIN");

  try {
    database
      .prepare(
        `UPDATE students
            SET last_name = ?, first_name = ?, gender = ?, birth_date = ?,
                class_id = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
          WHERE id = ?`,
      )
      .run(
        fields.lastName,
        fields.firstName,
        fields.gender,
        fields.birthDate,
        fields.classId,
        id,
      );

    const after = readStudentOrThrow(database, id);

    writeAudit(
      database,
      id,
      "update",
      { before: snapshot(before), after: snapshot(after) },
      actor,
    );
    database.exec("COMMIT");

    return after;
  } catch (cause) {
    database.exec("ROLLBACK");
    throw cause;
  }
}

/**
 * Suppression définitive. L'élève est intégralement journalisé avant
 * disparition, ce qui rend l'opération traçable et récupérable à la main.
 */
export function deleteStudent(
  database: DatabaseSync,
  id: number,
  actor: string = defaultActor(),
): Student {
  const before = readStudentOrThrow(database, id);

  database.exec("BEGIN");

  try {
    database.prepare("DELETE FROM students WHERE id = ?").run(id);
    writeAudit(database, id, "delete", snapshot(before), actor);
    database.exec("COMMIT");

    return before;
  } catch (cause) {
    database.exec("ROLLBACK");
    throw cause;
  }
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

/* -------------------------------------------------------------------------- */
/* Journal d'audit — lecture                                                  */
/* -------------------------------------------------------------------------- */

export type AuditEntry = {
  id: number;
  entityId: number;
  action: string;
  actor: string;
  payload: unknown;
  createdAt: string;
};

export function listAuditForStudent(
  database: DatabaseSync,
  studentId: number,
  limit = 20,
): AuditEntry[] {
  const rows = database
    .prepare(
      `SELECT id, entity_id, action, actor, payload, created_at
         FROM audit_log
        WHERE entity = 'student' AND entity_id = ?
        ORDER BY id DESC
        LIMIT ?`,
    )
    .all(studentId, limit) as {
    id: number;
    entity_id: number;
    action: string;
    actor: string;
    payload: string | null;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    action: row.action,
    actor: row.actor,
    payload: row.payload ? safeParse(row.payload) : null,
    createdAt: row.created_at,
  }));
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
