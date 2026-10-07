import type { DatabaseSync } from "node:sqlite";
import { currentActor } from "../auth/session.js";
import type {
  Absence,
  AbsenceInput,
  AbsencePeriod,
  AbsenceQuery,
  AbsenceSummary,
  AttendanceRow,
} from "../../src/types/models.js";

type AbsenceRow = {
  id: number;
  student_id: number;
  matricule: string;
  last_name: string;
  first_name: string;
  class_id: number | null;
  class_name: string | null;
  date: string;
  period: string;
  justified: number;
  reason: string | null;
  recorded_by: string;
  created_at: string;
};

const ABSENCE_SELECT = `SELECT a.id, a.student_id, s.matricule, s.last_name, s.first_name,
              s.class_id, c.name AS class_name, a.date, a.period, a.justified,
              a.reason, a.recorded_by, a.created_at
         FROM absences a
         JOIN students s ON s.id = a.student_id
         LEFT JOIN classes c ON c.id = s.class_id`;

function isPeriod(value: string): value is AbsencePeriod {
  return value === "full" || value === "am" || value === "pm";
}

function mapAbsence(row: AbsenceRow): Absence {
  return {
    id: row.id,
    studentId: row.student_id,
    matricule: row.matricule,
    lastName: row.last_name,
    firstName: row.first_name,
    classId: row.class_id,
    className: row.class_name,
    date: row.date,
    period: isPeriod(row.period) ? row.period : "full",
    justified: row.justified === 1,
    reason: row.reason,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si la chaîne est une date réelle au format AAAA-MM-JJ. */
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validate(input: AbsenceInput): {
  studentId: number;
  date: string;
  period: AbsencePeriod;
  justified: boolean;
  reason: string | null;
} {
  if (!Number.isInteger(input.studentId) || input.studentId <= 0) {
    throw new Error("L'élève est obligatoire.");
  }

  const date = input.date?.trim() ?? "";

  if (!isRealDate(date)) {
    throw new Error("La date de l'absence est invalide.");
  }

  if (!isPeriod(input.period)) {
    throw new Error("La demi-journée est invalide.");
  }

  const reason = input.reason?.trim() ?? "";

  if (reason.length > 200) {
    throw new Error("Le motif ne peut pas dépasser 200 caractères.");
  }

  return {
    studentId: input.studentId,
    date,
    period: input.period,
    justified: input.justified === true,
    reason: reason || null,
  };
}

/** Vérifie que l'élève existe : une absence orpheline n'a pas de sens. */
function assertStudentExists(database: DatabaseSync, studentId: number): void {
  const row = database
    .prepare("SELECT 1 AS ok FROM students WHERE id = ?")
    .get(studentId);

  if (!row) {
    throw new Error("Cet élève n'existe pas.");
  }
}

const PERIOD_LABELS: Record<AbsencePeriod, string> = {
  full: "journée",
  am: "matin",
  pm: "après-midi",
};

function snapshot(absence: Absence) {
  return {
    studentId: absence.studentId,
    matricule: absence.matricule,
    date: absence.date,
    period: absence.period,
    justified: absence.justified,
    reason: absence.reason,
  };
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
       VALUES ('absence', ?, ?, ?, ?)`,
    )
    .run(entityId, action, actor, JSON.stringify(payload));
}

function readAbsence(database: DatabaseSync, id: number): Absence | null {
  const row = database
    .prepare(`${ABSENCE_SELECT} WHERE a.id = ?`)
    .get(id) as AbsenceRow | undefined;

  return row ? mapAbsence(row) : null;
}

function readAbsenceOrThrow(database: DatabaseSync, id: number): Absence {
  const absence = readAbsence(database, id);

  if (!absence) {
    throw new Error("Cette absence n'existe pas.");
  }

  return absence;
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                    */
/* -------------------------------------------------------------------------- */

function buildFilter(query: AbsenceQuery): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.studentId !== undefined) {
    conditions.push("a.student_id = ?");
    params.push(query.studentId);
  }

  if (query.classIds && query.classIds.length > 0) {
    conditions.push(`s.class_id IN (${query.classIds.map(() => "?").join(", ")})`);
    params.push(...query.classIds);
  }

  const from = query.from?.trim();
  const to = query.to?.trim();

  if (from) {
    conditions.push("a.date >= ?");
    params.push(from);
  }

  if (to) {
    conditions.push("a.date <= ?");
    params.push(to);
  }

  if (query.justified !== undefined) {
    conditions.push("a.justified = ?");
    params.push(query.justified ? 1 : 0);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function listAbsences(
  database: DatabaseSync,
  query: AbsenceQuery = {},
): Absence[] {
  const { where, params } = buildFilter(query);
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 500), 1), 2000);
  const offset = Math.max(Math.trunc(query.offset ?? 0), 0);

  const rows = database
    .prepare(
      `${ABSENCE_SELECT}
         ${where}
        ORDER BY a.date DESC, s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE
        LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as AbsenceRow[];

  return rows.map(mapAbsence);
}

export function countAbsences(
  database: DatabaseSync,
  query: AbsenceQuery = {},
): number {
  const { where, params } = buildFilter(query);

  const row = database
    .prepare(
      `SELECT COUNT(*) AS total
         FROM absences a
         JOIN students s ON s.id = a.student_id
         ${where}`,
    )
    .get(...params) as { total: number };

  return row.total;
}

/**
 * Élèves d'une classe pour une date donnée, avec l'absence éventuellement déjà
 * enregistrée. C'est la base de la saisie rapide : une ligne par élève, et
 * `periods` énumère les demi-journées déjà marquées absentes.
 */
export function listAttendance(
  database: DatabaseSync,
  classId: number,
  date: string,
): AttendanceRow[] {
  if (!Number.isInteger(classId)) {
    throw new Error("La classe est obligatoire.");
  }

  if (!isRealDate(date)) {
    throw new Error("La date est invalide.");
  }

  const students = database
    .prepare(
      `SELECT s.id, s.matricule, s.last_name, s.first_name, s.class_id,
              c.name AS class_name
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.class_id = ? AND s.status = 'active'
        ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`,
    )
    .all(classId) as {
    id: number;
    matricule: string;
    last_name: string;
    first_name: string;
    class_id: number | null;
    class_name: string | null;
  }[];

  const absences = database
    .prepare(
      `SELECT a.id, a.student_id, a.period, a.justified, a.reason
         FROM absences a
         JOIN students s ON s.id = a.student_id
        WHERE a.date = ? AND s.class_id = ?`,
    )
    .all(date, classId) as {
    id: number;
    student_id: number;
    period: string;
    justified: number;
    reason: string | null;
  }[];

  return students.map((student) => {
    const own = absences.filter((entry) => entry.student_id === student.id);

    return {
      studentId: student.id,
      matricule: student.matricule,
      lastName: student.last_name,
      firstName: student.first_name,
      classId: student.class_id,
      className: student.class_name,
      periods: own
        .map((entry) => entry.period)
        .filter(isPeriod),
      justified: own.length > 0 && own.every((entry) => entry.justified === 1),
      reason: own.find((entry) => entry.reason)?.reason ?? null,
    };
  });
}

/**
 * Bascule une demi-journée pour un élève : enregistre l'absence si elle
 * n'existe pas, la supprime sinon. Renvoie l'état après l'opération.
 */
export function toggleAbsence(
  database: DatabaseSync,
  input: AbsenceInput,
  actor: string = currentActor(),
): { absent: boolean; absenceId: number | null } {
  const fields = validate(input);
  assertStudentExists(database, fields.studentId);

  const existing = database
    .prepare(
      "SELECT id FROM absences WHERE student_id = ? AND date = ? AND period = ?",
    )
    .get(fields.studentId, fields.date, fields.period) as { id: number } | undefined;

  if (existing) {
    deleteAbsence(database, existing.id, actor);

    return { absent: false, absenceId: null };
  }

  const created = createAbsence(database, input, actor);

  return { absent: true, absenceId: created.id };
}

export function getAbsenceSummary(
  database: DatabaseSync,
  studentId: number,
): AbsenceSummary {
  const row = database
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN period = 'full' THEN 2 ELSE 1 END) AS halfDays,
         SUM(CASE WHEN justified = 1 THEN 1 ELSE 0 END) AS justified
       FROM absences
       WHERE student_id = ?`,
    )
    .get(studentId) as {
    total: number | null;
    halfDays: number | null;
    justified: number | null;
  };

  const unjustified = database
    .prepare(
      "SELECT COUNT(*) AS total FROM absences WHERE student_id = ? AND justified = 0",
    )
    .get(studentId) as { total: number };

  return {
    studentId,
    total: row.total ?? 0,
    halfDays: row.halfDays ?? 0,
    justified: row.justified ?? 0,
    unjustified: unjustified.total,
  };
}

/* -------------------------------------------------------------------------- */
/* Écritures                                                                  */
/* -------------------------------------------------------------------------- */

export function createAbsence(
  database: DatabaseSync,
  input: AbsenceInput,
  actor: string = currentActor(),
): Absence {
  const fields = validate(input);
  assertStudentExists(database, fields.studentId);

  database.exec("BEGIN");

  try {
    const info = database
      .prepare(
        `INSERT INTO absences (student_id, date, period, justified, reason, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fields.studentId,
        fields.date,
        fields.period,
        fields.justified ? 1 : 0,
        fields.reason,
        actor,
      );

    const created = readAbsenceOrThrow(database, Number(info.lastInsertRowid));

    writeAudit(database, created.id, "create", snapshot(created), actor);
    database.exec("COMMIT");

    return created;
  } catch (cause) {
    database.exec("ROLLBACK");

    // Contrainte d'unicité : l'absence existe déjà pour cette demi-journée.
    if (String(cause).includes("UNIQUE")) {
      throw new Error(
        `Une absence est déjà enregistrée pour cet élève (${PERIOD_LABELS[fields.period]} du ${fields.date}).`,
        { cause },
      );
    }

    throw cause;
  }
}

export function updateAbsence(
  database: DatabaseSync,
  id: number,
  input: AbsenceInput,
  actor: string = currentActor(),
): Absence {
  const before = readAbsenceOrThrow(database, id);
  const fields = validate(input);
  assertStudentExists(database, fields.studentId);

  database.exec("BEGIN");

  try {
    database
      .prepare(
        `UPDATE absences
            SET student_id = ?, date = ?, period = ?, justified = ?, reason = ?,
                updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
          WHERE id = ?`,
      )
      .run(
        fields.studentId,
        fields.date,
        fields.period,
        fields.justified ? 1 : 0,
        fields.reason,
        id,
      );

    const after = readAbsenceOrThrow(database, id);

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

    if (String(cause).includes("UNIQUE")) {
      throw new Error(
        "Une autre absence existe déjà pour cet élève à cette date.",
        { cause },
      );
    }

    throw cause;
  }
}

export function deleteAbsence(
  database: DatabaseSync,
  id: number,
  actor: string = currentActor(),
): Absence {
  const before = readAbsenceOrThrow(database, id);

  database.exec("BEGIN");

  try {
    database.prepare("DELETE FROM absences WHERE id = ?").run(id);
    writeAudit(database, id, "delete", snapshot(before), actor);
    database.exec("COMMIT");

    return before;
  } catch (cause) {
    database.exec("ROLLBACK");
    throw cause;
  }
}
