import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ChevronRight, FolderOpen, Search } from "lucide-react";
import { listClasses, listStudents } from "../../services/api";
import { errorMessage, initialsOf, statusClass } from "../../lib/labels";
import type { ClassRoom, Student } from "../../types/models";

function StudentDossiersPage() {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [result, setResult] = useState<{
    key: string;
    rows: Student[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => ({ search, classIds: classId ? [Number(classId)] : [] }),
    [search, classId],
  );
  const key = JSON.stringify(query);
  const loading = result === null || result.key !== key;
  const students = useMemo(() => result?.rows ?? [], [result]);

  useEffect(() => {
    let cancelled = false;

    listClasses()
      .then((rows) => {
        if (!cancelled) {
          setClasses(rows);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    listStudents(query)
      .then((rows) => {
        if (!cancelled) {
          setResult({ key, rows });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ key, rows: [] });
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, key]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-56 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un nom ou un matricule…"
                className="input input-sm w-full pl-9"
              />
            </label>

            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              aria-label="Filtrer par classe"
              className="select select-sm bg-base-300"
            >
              <option value="">Toutes les classes</option>
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>

            <span className="ml-auto text-xs tabular-nums text-base-content/50">
              {students.length} dossier(s)
            </span>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-box bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-base-content/50">
              <span className="loading loading-spinner loading-sm" />
              Chargement…
            </div>
          ) : null}

          {!loading && !error && students.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <FolderOpen
                className="h-8 w-8 text-base-content/30"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium text-base-content">
                Aucun dossier trouvé
              </p>
              <p className="text-xs text-base-content/50">
                Modifie la recherche ou la classe.
              </p>
            </div>
          ) : null}

          {!loading && students.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {students.map((student) => (
                <Link
                  key={student.id}
                  to={`/eleves/dossiers/${student.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-base-content/10 bg-base-300 px-4 py-3.5 transition hover:border-base-content/25 hover:bg-base-content/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-content/10 text-sm font-semibold text-base-content/70">
                    {initialsOf(student)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-base-content">
                      {student.lastName.toUpperCase()} {student.firstName}
                    </span>
                    <span className="block truncate text-xs text-base-content/50">
                      {student.matricule} · {student.className ?? "Sans classe"}
                    </span>
                  </span>

                  <span
                    className={clsx(
                      "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      statusClass[student.status],
                    )}
                  >
                    {student.status === "active" ? "Actif" : "Sorti"}
                  </span>

                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-base-content/30 transition group-hover:text-base-content/70"
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StudentDossiersPage;
