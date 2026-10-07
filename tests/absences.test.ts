import { assert, assertEquals, assertThrows, test } from "./harness.ts";
import { resetDataDirectory } from "./helpers.ts";
import { closeDatabase, getDatabase } from "../electron/db/index.ts";
import {
  countAbsences,
  createAbsence,
  deleteAbsence,
  getAbsenceSummary,
  listAbsences,
  listAttendance,
  toggleAbsence,
  updateAbsence,
} from "../electron/db/absences.ts";
import { createStudent, listClasses } from "../electron/db/students.ts";
import type { AbsenceInput } from "../src/types/models.ts";

function withFreshAbsences(run: (classIds: number[], studentIds: number[]) => void): void {
  resetDataDirectory("absences");

  const database = getDatabase();
  const classes = listClasses(database);
  const classIds = classes.map((classroom) => classroom.id);

  // Deux élèves créés à la main : la population du seed n'est pas garantie
  // d'être répartie comme les tests l'attendent.
  const first = createStudent(
    database,
    {
      lastName: "Absent",
      firstName: "Alice",
      gender: "F",
      birthDate: "2012-01-01",
      classId: classIds[0],
    },
    "test",
  );
  const second = createStudent(
    database,
    {
      lastName: "Present",
      firstName: "Bruno",
      gender: "M",
      birthDate: "2012-01-02",
      classId: classIds[0],
    },
    "test",
  );

  try {
    run(classIds, [first.id, second.id]);
  } finally {
    closeDatabase();
  }
}

function input(overrides: Partial<AbsenceInput> = {}): AbsenceInput {
  return {
    studentId: 1,
    date: "2026-03-10",
    period: "full",
    justified: false,
    reason: null,
    ...overrides,
  };
}

export function registerAbsenceTests(): void {
  test("une absence est créée et rattachée à son élève", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const created = createAbsence(
        database,
        input({ studentId, reason: "Maladie", justified: true }),
        "prof@ecole.fr",
      );

      assertEquals(created.studentId, studentId, "élève");
      assertEquals(created.date, "2026-03-10", "date");
      assertEquals(created.period, "full", "demi-journée");
      assertEquals(created.justified, true, "justifiée");
      assertEquals(created.reason, "Maladie", "motif");
      assertEquals(created.recordedBy, "prof@ecole.fr", "auteur de la saisie");
      assert(created.matricule.startsWith("SC-"), "matricule joint");
      assert(created.lastName === "Absent", "nom joint");
    });
  });

  test("la même demi-journée ne peut pas être enregistrée deux fois", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();

      createAbsence(database, input({ studentId, period: "am" }));

      assertThrows(
        () => createAbsence(database, input({ studentId, period: "am" })),
        "déjà enregistrée",
        "doublon sur la même demi-journée",
      );

      // Une autre demi-journée du même jour reste possible.
      const afternoon = createAbsence(database, input({ studentId, period: "pm" }));
      assertEquals(afternoon.period, "pm", "après-midi acceptée");

      // Tout comme une journée entière un autre jour.
      const otherDay = createAbsence(
        database,
        input({ studentId, date: "2026-03-11" }),
      );
      assertEquals(otherDay.date, "2026-03-11", "autre jour accepté");
    });
  });

  test("les saisies invalides sont refusées", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const before = countAbsences(database, {});

      assertThrows(
        () => createAbsence(database, input({ studentId, date: "10/03/2026" })),
        "invalide",
        "date au mauvais format",
      );
      assertThrows(
        () => createAbsence(database, input({ studentId, date: "2026-02-31" })),
        "invalide",
        "date inexistante",
      );
      assertThrows(
        () => createAbsence(database, input({ studentId, date: "2026-13-01" })),
        "invalide",
        "mois invalide",
      );
      assertThrows(
        () => createAbsence(database, input({ studentId, period: "soir" as never })),
        "demi-journée",
        "demi-journée inconnue",
      );
      assertThrows(
        () => createAbsence(database, input({ studentId: 0 })),
        "élève",
        "identifiant d'élève invalide",
      );
      assertThrows(
        () => createAbsence(database, input({ studentId: 999_999 })),
        "n'existe pas",
        "élève inexistant",
      );
      assertThrows(
        () =>
          createAbsence(
            database,
            input({ studentId, reason: "x".repeat(201) }),
          ),
        "200 caractères",
        "motif trop long",
      );

      assertEquals(
        countAbsences(database, {}),
        before,
        "aucune absence ne doit avoir été écrite",
      );
    });
  });

  test("le basculement enregistre puis retire l'absence", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const target = input({ studentId, period: "pm" });

      const marked = toggleAbsence(database, target, "prof@ecole.fr");
      assertEquals(marked.absent, true, "absence enregistrée");
      assert(marked.absenceId !== null, "identifiant renvoyé");
      assertEquals(countAbsences(database, { studentId }), 1, "une absence");

      const cleared = toggleAbsence(database, target, "prof@ecole.fr");
      assertEquals(cleared.absent, false, "absence retirée");
      assertEquals(cleared.absenceId, null, "plus d'identifiant");
      assertEquals(countAbsences(database, { studentId }), 0, "aucune absence");
    });
  });

  test("le basculement est journalisé dans les deux sens", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const target = input({ studentId, date: "2026-04-01" });

      toggleAbsence(database, target, "prof@ecole.fr");
      toggleAbsence(database, target, "prof@ecole.fr");

      const entries = database
        .prepare(
          `SELECT action, actor FROM audit_log
            WHERE entity = 'absence' ORDER BY id`,
        )
        .all() as { action: string; actor: string }[];

      assertEquals(entries.length, 2, "deux entrées d'audit");
      assertEquals(entries[0].action, "create", "première action");
      assertEquals(entries[1].action, "delete", "seconde action");
      assertEquals(entries[0].actor, "prof@ecole.fr", "auteur journalisé");
    });
  });

  test("la liste se filtre par élève, classe, période et justification", () => {
    withFreshAbsences((classIds, [first, second]) => {
      const database = getDatabase();

      createAbsence(database, input({ studentId: first, date: "2026-03-01" }));
      createAbsence(
        database,
        input({ studentId: first, date: "2026-03-05", justified: true }),
      );
      createAbsence(
        database,
        input({ studentId: second, date: "2026-03-10", period: "am" }),
      );

      assertEquals(listAbsences(database, {}).length, 3, "toutes les absences");
      assertEquals(
        listAbsences(database, { studentId: first }).length,
        2,
        "filtre par élève",
      );
      assertEquals(
        listAbsences(database, { classIds: [classIds[0]] }).length,
        3,
        "filtre par classe",
      );
      assertEquals(
        listAbsences(database, { justified: true }).length,
        1,
        "filtre justifiées",
      );
      assertEquals(
        listAbsences(database, { justified: false }).length,
        2,
        "filtre non justifiées",
      );

      // Bornes de dates inclusives.
      assertEquals(
        listAbsences(database, { from: "2026-03-01", to: "2026-03-05" }).length,
        2,
        "intervalle inclusif",
      );
      assertEquals(
        listAbsences(database, { from: "2026-03-06" }).length,
        1,
        "borne basse seule",
      );
      assertEquals(
        listAbsences(database, { to: "2026-03-04" }).length,
        1,
        "borne haute seule",
      );

      // Tri du plus récent au plus ancien.
      const ordered = listAbsences(database, {}).map((absence) => absence.date);
      assertEquals(
        JSON.stringify(ordered),
        JSON.stringify(["2026-03-10", "2026-03-05", "2026-03-01"]),
        "tri décroissant par date",
      );

      // Pagination.
      assertEquals(
        listAbsences(database, { limit: 2, offset: 0 }).length,
        2,
        "première page",
      );
      assertEquals(
        listAbsences(database, { limit: 2, offset: 2 }).length,
        1,
        "seconde page",
      );
    });
  });

  test("le résumé compte les demi-journées et les non justifiées", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();

      createAbsence(database, input({ studentId, date: "2026-05-04", period: "am" }));
      createAbsence(
        database,
        input({ studentId, date: "2026-05-05", period: "full", justified: true }),
      );

      const summary = getAbsenceSummary(database, studentId);

      assertEquals(summary.total, 2, "deux enregistrements");
      // Une demi-journée + une journée entière = 3 demi-journées.
      assertEquals(summary.halfDays, 3, "demi-journées cumulées");
      assertEquals(summary.justified, 1, "une justifiée");
      assertEquals(summary.unjustified, 1, "une non justifiée");

      const empty = getAbsenceSummary(database, studentId + 1000);
      assertEquals(empty.total, 0, "élève sans absence");
      assertEquals(empty.halfDays, 0, "aucune demi-journée");
    });
  });

  test("la saisie rapide renvoie les élèves actifs avec leur état", () => {
    withFreshAbsences((classIds, [absent]) => {
      const database = getDatabase();
      const date = "2026-06-15";

      // Une journée entière pour le premier élève, rien pour le second.
      createAbsence(database, input({ studentId: absent, date, period: "full" }));

      const rows = listAttendance(database, classIds[0], date);

      assert(rows.length >= 2, `au moins deux élèves (obtenu ${rows.length})`);

      const marked = rows.find((row) => row.studentId === absent);
      const untouched = rows.find((row) => row.studentId !== absent);

      assert(marked !== undefined, "l'élève absent doit apparaître");
      assertEquals(marked.periods.includes("full"), true, "journée marquée absente");
      assert(untouched !== undefined, "le second élève doit apparaître");
      assertEquals(untouched.periods.length, 0, "aucune absence pour lui");

      // Un élève sorti ne doit pas être proposé à la saisie.
      database.prepare("UPDATE students SET status = 'inactive' WHERE id = ?").run(absent);
      const afterExit = listAttendance(database, classIds[0], date);

      assert(
        !afterExit.some((row) => row.studentId === absent),
        "un élève sorti n'est plus proposé",
      );
    });
  });

  test("la saisie rapide valide la classe et la date", () => {
    withFreshAbsences(() => {
      const database = getDatabase();

      assertThrows(
        () => listAttendance(database, 0.5, "2026-01-01"),
        "classe",
        "classe non entière",
      );
      assertThrows(
        () => listAttendance(database, 1, "01/01/2026"),
        "date",
        "date au mauvais format",
      );
    });
  });

  test("une absence peut être modifiée et journalise l'avant/après", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const created = createAbsence(database, input({ studentId, period: "am" }));

      const updated = updateAbsence(
        database,
        created.id,
        input({ studentId, period: "full", justified: true, reason: "Certificat" }),
        "prof@ecole.fr",
      );

      assertEquals(updated.period, "full", "demi-journée modifiée");
      assertEquals(updated.justified, true, "justification modifiée");
      assertEquals(updated.reason, "Certificat", "motif enregistré");

      const entries = database
        .prepare(
          `SELECT action, payload FROM audit_log
            WHERE entity = 'absence' AND entity_id = ? ORDER BY id DESC LIMIT 1`,
        )
        .get(created.id) as { action: string; payload: string };

      assertEquals(entries.action, "update", "action journalisée");

      const payload = JSON.parse(entries.payload) as {
        before: { period: string };
        after: { period: string; reason: string };
      };

      assertEquals(payload.before.period, "am", "valeur avant");
      assertEquals(payload.after.period, "full", "valeur après");
      assertEquals(payload.after.reason, "Certificat", "motif après");
    });
  });

  test("supprimer une absence journalise la fiche retirée", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();
      const created = createAbsence(
        database,
        input({ studentId, reason: "Rendez-vous médical" }),
      );

      const removed = deleteAbsence(database, created.id, "prof@ecole.fr");

      assertEquals(removed.id, created.id, "absence renvoyée");
      assertEquals(listAbsences(database, { studentId }).length, 0, "absence retirée");

      const entries = database
        .prepare(
          `SELECT action, actor, payload FROM audit_log
            WHERE entity = 'absence' ORDER BY id DESC LIMIT 1`,
        )
        .get() as { action: string; actor: string; payload: string };

      assertEquals(entries.action, "delete", "action journalisée");
      assertEquals(entries.actor, "prof@ecole.fr", "auteur journalisé");

      const payload = JSON.parse(entries.payload) as { reason: string };
      assertEquals(payload.reason, "Rendez-vous médical", "motif conservé");
    });
  });

  test("modifier ou supprimer une absence inexistante échoue proprement", () => {
    withFreshAbsences((_classIds, [studentId]) => {
      const database = getDatabase();

      assertThrows(
        () => updateAbsence(database, 999_999, input({ studentId })),
        "n'existe pas",
        "modification d'une absence inexistante",
      );
      assertThrows(
        () => deleteAbsence(database, 999_999),
        "n'existe pas",
        "suppression d'une absence inexistante",
      );
    });
  });

  test("supprimer un élève emporte ses absences", () => {
    withFreshAbsences((_assert, [studentId]) => {
      const database = getDatabase();
      createAbsence(database, input({ studentId, date: "2026-07-01" }));
      assertEquals(countAbsences(database, { studentId }), 1, "absence présente");

      database.prepare("DELETE FROM students WHERE id = ?").run(studentId);

      // ON DELETE CASCADE : plus aucune absence orpheline.
      assertEquals(
        countAbsences(database, { studentId }),
        0,
        "les absences suivent l'élève supprimé",
      );
    });
  });
}
