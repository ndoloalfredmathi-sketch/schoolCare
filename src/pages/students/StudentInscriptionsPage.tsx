import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, UserPlus, Users, X } from "lucide-react";
import {
  createStudent,
  listClasses,
  listRecentStudents,
} from "../../services/api";
import type { ClassRoom, Gender, Student } from "../../types/models";

const genderOrder: Gender[] = ["F", "M"];

const genderLabels: Record<Gender, string> = {
  F: "Féminin",
  M: "Masculin",
};

const recentLimit = 8;

function errorMessage(cause: unknown): string {
  const raw = String(cause);
  const marker = raw.lastIndexOf("Error: ");

  return marker >= 0 ? raw.slice(marker + 7) : raw;
}

function StudentInscriptionsPage() {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [classId, setClassId] = useState("");

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [recent, setRecent] = useState<Student[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Student | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listClasses(), listRecentStudents(recentLimit)])
      .then(([classRows, studentRows]) => {
        if (!cancelled) {
          setClasses(classRows);
          setRecent(studentRows);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRecent([]);
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!lastName.trim() || !firstName.trim()) {
      setError("Le nom et le prénom sont obligatoires.");
      return;
    }

    if (!gender) {
      setError("Le sexe est obligatoire.");
      return;
    }

    if (!classId) {
      setError("La classe est obligatoire.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setCreated(null);

    try {
      const student = await createStudent({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        gender,
        birthDate: birthDate || null,
        classId: Number(classId),
      });

      setCreated(student);
      setLastName("");
      setFirstName("");
      setGender(null);
      setBirthDate("");
      setRecent((current) =>
        [student, ...(current ?? [])].slice(0, recentLimit),
      );
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "input input-sm w-full bg-base-300 text-base-content placeholder:text-base-content/30";
  const labelClass = "text-xs font-medium text-base-content/60";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="card border border-base-content/10 bg-base-200">
          <div className="card-body gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-content/10">
                <UserPlus className="h-4 w-4 text-base-content/70" strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-base-content">
                  Nouvel élève
                </h2>
                <p className="text-xs text-base-content/50">
                  Matricule attribué automatiquement.
                </p>
              </div>
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-box bg-error/10 px-4 py-3 text-sm text-error">
                <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Fermer le message d'erreur"
                  className="shrink-0 opacity-60 transition hover:opacity-100"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ) : null}

            {created ? (
              <div
                role="status"
                className="flex items-center gap-2 rounded-box bg-success/10 px-4 py-3 text-sm text-success"
              >
                <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 break-words">
                  {created.lastName.toUpperCase()} {created.firstName} inscrit
                  sous le matricule {created.matricule}.
                </span>
                <button
                  type="button"
                  onClick={() => setCreated(null)}
                  aria-label="Fermer la confirmation"
                  className="shrink-0 opacity-60 transition hover:opacity-100"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between rounded-xl border border-dashed border-base-content/15 bg-base-content/5 px-3 py-2">
                <span className="text-xs text-base-content/45">
                  Matricule
                </span>
                <span className="font-mono text-xs text-base-content/70">
                  SC-{new Date().getFullYear()}-XXXX
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Nom</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="BERNARD"
                    className={fieldClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Prénom</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="Aïcha"
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Sexe</span>
                <div role="radiogroup" aria-label="Sexe" className="grid grid-cols-2 gap-2">
                  {genderOrder.map((value) => (
                    <label
                      key={value}
                      className={clsx(
                        "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                        gender === value
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-base-content/15 bg-base-300 text-base-content/70 hover:border-base-content/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="gender"
                        className="radio radio-primary radio-sm"
                        checked={gender === value}
                        onChange={() => setGender(value)}
                      />
                      {genderLabels[value]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  Date de naissance{" "}
                  <span className="font-normal text-base-content/35">
                    (facultative)
                  </span>
                </span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Classe</span>
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  required
                  className="select select-sm w-full bg-base-300 text-base-content"
                >
                  <option value="">Choisir une classe…</option>
                  {classes.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm mt-1 w-full"
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                )}
                {submitting ? "Inscription…" : "Inscrire l'élève"}
              </button>
            </form>
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-200">
          <div className="card-body gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-base-content">
                  Dernières inscriptions
                </h2>
                <p className="text-xs text-base-content/50">
                  {recent === null
                    ? "Chargement…"
                    : `${recent.length} élève(s) inscrit(s) récemment`}
                </p>
              </div>
            </div>

            {recent === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-base-content/50">
                <span className="loading loading-spinner loading-sm" />
                Chargement…
              </div>
            ) : null}

            {recent !== null && recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-base-content/30" strokeWidth={1.5} />
                <p className="text-sm font-medium text-base-content">
                  Aucune inscription récente
                </p>
                <p className="text-xs text-base-content/50">
                  Le prochain élève inscrit apparaîtra ici.
                </p>
              </div>
            ) : null}

            {recent !== null && recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Matricule</th>
                      <th>Nom</th>
                      <th>Classe</th>
                      <th>Sexe</th>
                      <th>Naissance</th>
                      <th>Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((student) => (
                      <tr key={student.id}>
                        <td className="whitespace-nowrap font-mono text-xs text-base-content/60">
                          {student.matricule}
                        </td>
                        <td className="font-medium text-base-content">
                          {student.lastName.toUpperCase()} {student.firstName}
                        </td>
                        <td className="whitespace-nowrap text-base-content/70">
                          {student.className ?? "—"}
                        </td>
                        <td className="whitespace-nowrap text-base-content/70">
                          {student.gender === "F" ? "Féminin" : "Masculin"}
                        </td>
                        <td className="whitespace-nowrap text-base-content/70">
                          {student.birthDate ?? "—"}
                        </td>
                        <td className="whitespace-nowrap text-base-content/50">
                          {student.createdAt?.slice(0, 16) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentInscriptionsPage;
