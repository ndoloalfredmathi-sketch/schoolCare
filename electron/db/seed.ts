import type { DatabaseSync } from "node:sqlite";

const ACADEMIC_YEAR = "2026-2027";

const CLASSES = [
  { name: "6e A", level: "6e" },
  { name: "6e B", level: "6e" },
  { name: "5e A", level: "5e" },
  { name: "4e A", level: "4e" },
  { name: "3e A", level: "3e" },
  { name: "2nde A", level: "2nde" },
];

const FIRST_NAMES_F = [
  "Emma",
  "Lea",
  "Chloe",
  "Ines",
  "Manon",
  "Sarah",
  "Aicha",
  "Fatou",
  "Nadia",
  "Yasmine",
];

const FIRST_NAMES_M = [
  "Lucas",
  "Hugo",
  "Nathan",
  "Ethan",
  "Louis",
  "Adam",
  "Sofiane",
  "Moussa",
  "Ibrahim",
  "Thomas",
  "Alfred Mathi",
];

const LAST_NAMES = [
  "Diallo",
  "Martin",
  "Bernard",
  "Kone",
  "Nguyen",
  "Robert",
  "Fofana",
  "Petit",
  "Traore",
  "Moreau",
  "Diop",
  "Garcia",
  "NDOLO",
];

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

export function seedDemoData(database: DatabaseSync): void {
  const row = database
    .prepare("SELECT COUNT(*) AS total FROM classes")
    .get() as { total: number };

  if (row.total > 0) {
    return;
  }

  const insertClass = database.prepare(
    "INSERT INTO classes (name, level, academic_year) VALUES (?, ?, ?)",
  );

  for (const classroom of CLASSES) {
    insertClass.run(classroom.name, classroom.level, ACADEMIC_YEAR);
  }

  const insertStudent = database.prepare(
    `INSERT INTO students (matricule, last_name, first_name, gender, birth_date, class_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  let total = 0;

  for (let classIndex = 0; classIndex < CLASSES.length; classIndex += 1) {
    const classId = classIndex + 1;

    for (let position = 0; position < 8; position += 1) {
      const index = total;
      const isFemale = index % 2 === 0;
      const lastName = LAST_NAMES[index % LAST_NAMES.length];
      const firstName = isFemale
        ? FIRST_NAMES_F[index % FIRST_NAMES_F.length]
        : FIRST_NAMES_M[index % FIRST_NAMES_M.length];
      const birthYear = 2008 + (classIndex % 5);
      const birthMonth = pad((index % 12) + 1, 2);
      const birthDay = pad((index % 27) + 1, 2);
      const inactive = index % 11 === 0;

      insertStudent.run(
        `SC-${ACADEMIC_YEAR.slice(0, 4)}-${pad(index + 1, 4)}`,
        lastName,
        firstName,
        isFemale ? "F" : "M",
        `${birthYear}-${birthMonth}-${birthDay}`,
        classId,
        inactive ? "inactive" : "active",
      );

      total += 1;
    }
  }
}
