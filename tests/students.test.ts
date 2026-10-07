import { assert, assertEquals, assertThrows, test } from "./harness.ts";
import { resetDataDirectory } from "./helpers.ts";
import { closeDatabase, getDatabase } from "../electron/db/index.js";
import {
  countStudents,
  createStudent,
  deleteStudent,
  getStudent,
  listAuditForStudent,
  listClasses,
  listRecentStudents,
  listStudents,
  listStudentsPage,
  updateStudent,
} from "../electron/db/students.js";
import type { StudentInput } from "../src/types/models.js";

function withFreshStudents(run: (classIds: number[]) => void): void {
  resetDataDirectory("students");

  const database = getDatabase();
  const classIds = listClasses(database).map((classroom) => classroom.id);

  try {
    run(classIds);
  } finally {
    closeDatabase();
  }
}

function input(overrides: Partial<StudentInput> = {}): StudentInput {
  return {
    lastName: "Dupont",
    firstName: "Marie",
    gender: "F",
    birthDate: "2012-03-04",
    classId: 1,
    ...overrides,
  };
}

export function registerStudentTests(): void {
  test("un élève est créé avec un matricule attribué automatiquement", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(database, input({ classId: classIds[0] }));

      assert(
        /^SC-\d{4}-\d{4}$/.test(created.matricule),
        `matricule inattendu : ${created.matricule}`,
      );
      assertEquals(created.lastName, "Dupont", "nom");
      assertEquals(created.firstName, "Marie", "prénom");
      assertEquals(created.status, "active", "statut initial");
      assertEquals(
        created.classId,
        classIds[0],
        "classe enregistrée",
      );
      assert(
        created.className !== null && created.className.length > 0,
        `le nom de classe doit être joint (obtenu ${created.className})`,
      );
      assert(created.createdAt !== null, "createdAt renseigné");
      assert(created.updatedAt !== null, "updatedAt renseigné à la création");

      // Les espaces superflus doivent être retirés.
      const trimmed = createStudent(
        database,
        input({ lastName: "  Espace  ", firstName: "  Jean  ", classId: classIds[0] }),
      );

      assertEquals(trimmed.lastName, "Espace", "nom sans espaces");
      assertEquals(trimmed.firstName, "Jean", "prénom sans espaces");
    });
  });

  test("les matricules s'enchaînent sans trou ni doublon", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(database, input({ classId: classIds[0] }));

      // Le jeu de démonstration occupe 0001 à 0048 : le suivant doit être 0049.
      assert(
        created.matricule.endsWith("0049"),
        `matricule attendu en 0049, obtenu ${created.matricule}`,
      );

      const next = createStudent(database, input({ classId: classIds[0] }));
      assert(
        next.matricule.endsWith("0050"),
        `matricule attendu en 0050, obtenu ${next.matricule}`,
      );

      // Un matricule corrompu ne doit pas casser l'attribution suivante.
      database
        .prepare(
          `INSERT INTO students (matricule, last_name, first_name, gender, class_id)
           VALUES (?, 'Corrompu', 'Test', 'M', ?)`,
        )
        .run(`SC-${new Date().getFullYear()}-ABCD`, classIds[0]);

      const afterGarbage = createStudent(database, input({ classId: classIds[0] }));
      assert(
        /^SC-\d{4}-\d{4}$/.test(afterGarbage.matricule),
        `matricule inattendu : ${afterGarbage.matricule}`,
      );
    });
  });

  test("les données invalides sont refusées avant écriture", () => {
    withFreshStudents(() => {
      const database = getDatabase();
      const before = listStudents(database, {}).length;
      const attempt = (overrides: Partial<StudentInput>) => () =>
        createStudent(database, input(overrides));

      assertThrows(attempt({ lastName: "   " }), "obligatoires", "nom vide");
      assertThrows(attempt({ firstName: "" }), "obligatoires", "prénom vide");
      assertThrows(attempt({ gender: "X" as never }), "sexe", "sexe invalide");
      assertThrows(
        attempt({ birthDate: "04/03/2012" }),
        "invalide",
        "date au mauvais format",
      );
      assertThrows(
        attempt({ birthDate: "2012-02-31" }),
        "calendrier",
        "date inexistante",
      );
      assertThrows(attempt({ birthDate: "2012-04-31" }), "calendrier", "31 avril");
      assertThrows(
        attempt({ classId: 999_999 }),
        "n'existe pas",
        "classe inexistante",
      );
      assertThrows(
        attempt({ classId: undefined as never }),
        "obligatoire",
        "classe absente",
      );

      assertEquals(
        listStudents(database, {}).length,
        before,
        "aucune écriture ne doit avoir eu lieu",
      );
    });
  });

  test("les dates valides limites sont acceptées", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();

      // 2012 est bissextile : le 29 février est valide.
      const leap = createStudent(
        database,
        input({ birthDate: "2012-02-29", classId: classIds[0] }),
      );
      assertEquals(leap.birthDate, "2012-02-29", "29 février d'une année bissextile");

      // Une date de naissance reste facultative.
      const withoutDate = createStudent(
        database,
        input({ birthDate: null, classId: classIds[0] }),
      );
      assertEquals(withoutDate.birthDate, null, "date facultative");

      assertThrows(
        () => createStudent(database, input({ birthDate: "2011-02-29" })),
        "calendrier",
        "29 février d'une année non bissextile",
      );
    });
  });

  test("une modification met à jour l'horodatage et journalise l'avant/après", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(database, input({ classId: classIds[0] }));

      const updated = updateStudent(
        database,
        created.id,
        input({ lastName: "Durand", classId: classIds[1] }),
      );

      assertEquals(updated.lastName, "Durand", "nom modifié");
      assertEquals(updated.classId, classIds[1], "classe modifiée");
      assert(
        updated.updatedAt !== null &&
          created.updatedAt !== null &&
          updated.updatedAt >= created.updatedAt,
        `updated_at ne doit jamais reculer (${created.updatedAt} -> ${updated.updatedAt})`,
      );
      assertEquals(updated.createdAt, created.createdAt, "created_at inchangé");

      const audit = listAuditForStudent(database, created.id);
      assertEquals(audit.length, 2, "deux entrées d'audit");
      assertEquals(audit[0].action, "update", "dernière action");

      const payload = audit[0].payload as {
        before: { lastName: string; classId: number };
        after: { lastName: string; classId: number };
      };

      assertEquals(payload.before.lastName, "Dupont", "valeur avant");
      assertEquals(payload.after.lastName, "Durand", "valeur après");
      assertEquals(payload.before.classId, classIds[0], "classe avant");
      assertEquals(payload.after.classId, classIds[1], "classe après");
    });
  });

  test("modifier ou supprimer un élève inexistant échoue proprement", () => {
    withFreshStudents(() => {
      const database = getDatabase();

      assertThrows(
        () => updateStudent(database, 999_999, input()),
        "n'existe pas",
        "modification d'un élève inexistant",
      );
      assertThrows(
        () => deleteStudent(database, 999_999),
        "n'existe pas",
        "suppression d'un élève inexistant",
      );
    });
  });

  test("la suppression retire l'élève mais conserve sa trace", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(database, input({ classId: classIds[0] }));

      const removed = deleteStudent(database, created.id);

      assertEquals(removed.id, created.id, "la fiche supprimée est renvoyée");
      assertEquals(getStudent(database, created.id), null, "élève absent");
      assertEquals(
        listStudents(database, { search: created.matricule }).length,
        0,
        "introuvable par recherche",
      );

      const audit = listAuditForStudent(database, created.id);
      assertEquals(audit[0].action, "delete", "action journalisée");

      const snapshot = audit[0].payload as { matricule: string; lastName: string };
      assertEquals(snapshot.matricule, created.matricule, "matricule conservé");
      assertEquals(snapshot.lastName, "Dupont", "nom conservé");
    });
  });

  test("l'acteur de l'audit peut être précisé", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(
        database,
        input({ classId: classIds[0] }),
        "prof@ecole.fr",
      );

      const audit = listAuditForStudent(database, created.id);
      assertEquals(audit[0].actor, "prof@ecole.fr", "acteur transmis");
    });
  });

  test("la recherche et les filtres renvoient les bons élèves", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(
        database,
        input({ lastName: "Zorglub", firstName: "Zoé", classId: classIds[0] }),
      );

      assertEquals(
        listStudents(database, { search: "Zorglub" }).length,
        1,
        "recherche par nom",
      );
      assertEquals(
        listStudents(database, { search: "zorglub" }).length,
        1,
        "recherche insensible à la casse",
      );
      assertEquals(
        listStudents(database, { search: created.matricule }).length,
        1,
        "recherche par matricule",
      );
      assertEquals(
        listStudents(database, { search: "ZZZ-introuvable" }).length,
        0,
        "recherche sans résultat",
      );

      const inClass = listStudents(database, { classIds: [classIds[0]] });
      assert(
        inClass.every((student) => student.classId === classIds[0]),
        "le filtre par classe doit être strict",
      );
      assert(
        inClass.some((student) => student.id === created.id),
        "le nouvel élève doit apparaître",
      );

      const males = listStudents(database, { genders: ["M"] });
      assert(
        males.every((student) => student.gender === "M"),
        "le filtre par sexe doit être strict",
      );

      const inactive = listStudents(database, { statuses: ["inactive"] });
      assert(
        inactive.every((student) => student.status === "inactive"),
        "le filtre par statut doit être strict",
      );
      assert(inactive.length > 0, "le jeu de démonstration contient des sortants");

      // Les filtres se cumulent.
      const combined = listStudents(database, {
        classIds: [classIds[0]],
        statuses: ["active"],
        genders: ["F"],
      });

      assert(
        combined.every(
          (student) =>
            student.classId === classIds[0] &&
            student.status === "active" &&
            student.gender === "F",
        ),
        "les filtres doivent se cumuler",
      );
    });
  });

  test("la liste est triée par nom puis prénom", () => {
    withFreshStudents(() => {
      const students = listStudents(getDatabase(), {});
      const names = students.map(
        (student) => `${student.lastName.toLowerCase()}|${student.firstName.toLowerCase()}`,
      );

      assertEquals(
        JSON.stringify(names),
        JSON.stringify([...names].sort()),
        "l'ordre alphabétique doit être respecté",
      );
    });
  });

  test("les inscriptions récentes remontent les derniers créés", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();

      // Le jeu de démonstration est inséré dans la même seconde : on le retire
      // pour rendre l'ordre d'inscription sans ambiguïté.
      database.exec("DELETE FROM students");

      createStudent(database, input({ lastName: "ZzzPremier", classId: classIds[0] }));
      createStudent(database, input({ lastName: "ZzzSecond", classId: classIds[0] }));

      const recent = listRecentStudents(database, 2);
      const names = recent.map((student) => student.lastName);

      // createdAt est identique à la seconde près : c'est le tri secondaire sur
      // l'identifiant qui doit garantir l'ordre d'inscription.
      assertEquals(
        JSON.stringify(names),
        JSON.stringify(["ZzzSecond", "ZzzPremier"]),
        "le plus récemment inscrit doit être en tête",
      );

      assertEquals(listRecentStudents(database, 1).length, 1, "limite respectée");
    });
  });

  test("supprimer une classe détache ses élèves sans les supprimer", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const created = createStudent(database, input({ classId: classIds[0] }));

      database.prepare("DELETE FROM classes WHERE id = ?").run(classIds[0]);

      const afterDelete = getStudent(database, created.id);

      assert(afterDelete !== null, "l'élève ne doit pas disparaître");
      assertEquals(afterDelete.classId, null, "la classe est détachée");
      assertEquals(afterDelete.className, null, "aucun nom de classe");
    });
  });

  test("la pagination ne saute ni ne répète aucun élève", () => {
    withFreshStudents(() => {
      const database = getDatabase();
      const pageSize = 10;
      const total = countStudents(database, {});
      const expectedPages = Math.ceil(total / pageSize);
      const seen: number[] = [];

      assertEquals(total, 48, "population de départ");

      let reportedTotal = 0;

      for (let index = 0; index < expectedPages; index += 1) {
        const page = listStudentsPage(
          database,
          {},
          { limit: pageSize, offset: index * pageSize },
        );

        reportedTotal = page.total;
        assertEquals(
          page.count,
          Math.min(pageSize, total - index * pageSize),
          `taille de la page ${index + 1}`,
        );

        seen.push(...page.rows.map((student) => student.id));
      }

      assertEquals(reportedTotal, total, "le total est stable sur toutes les pages");
      assertEquals(seen.length, total, "toutes les lignes sont renvoyées");
      assertEquals(
        new Set(seen).size,
        total,
        "aucun élève ne doit apparaître deux fois",
      );

      // L'ordre doit être continu : il correspond au tri par nom puis prénom.
      const ordered = listStudents(database, {});
      assertEquals(
        JSON.stringify(seen),
        JSON.stringify(ordered.map((student) => student.id)),
        "l'ordre est préservé à travers les pages",
      );

      // Un décalage au-delà des données renvoie une page vide, pas une erreur.
      const beyond = listStudentsPage(
        database,
        {},
        { limit: pageSize, offset: total + 5 },
      );

      assertEquals(beyond.rows.length, 0, "page au-delà des données");
      assertEquals(beyond.count, 0, "aucune ligne renvoyée");
      assertEquals(beyond.total, total, "le total reste exact");
    });
  });

  test("le total et le filtrage restent cohérents entre liste et pagination", () => {
    withFreshStudents((classIds) => {
      const database = getDatabase();
      const query = { classIds: [classIds[0]] };

      assertEquals(
        countStudents(database, query),
        listStudents(database, query).length,
        "le comptage doit correspondre à la liste filtrée",
      );

      const firstPage = listStudentsPage(database, query, { limit: 3, offset: 0 });
      const secondPage = listStudentsPage(database, query, { limit: 3, offset: 3 });

      for (const student of [...firstPage.rows, ...secondPage.rows]) {
        assertEquals(student.classId, classIds[0], "le filtre s'applique à chaque page");
      }

      assert(
        !firstPage.rows.some((student) =>
          secondPage.rows.some((other) => other.id === student.id),
        ),
        "les pages doivent être disjointes",
      );
    });
  });
}
