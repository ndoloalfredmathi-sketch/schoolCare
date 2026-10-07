import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, Download, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { listClasses, listStudents, listStudentsPage } from "../../services/api";
import { savePdf } from "../../services/exportPdf";
import {
  StudentListDocument,
  StudentProfileDocument,
} from "../../pdf/studentDocuments";
import { errorMessage, genderLabel, statusClass, statusLabels } from "../../lib/labels";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "../../types/models";
import type {
  ClassRoom,
  Gender,
  PageSize,
  StudentPage,
  StudentStatus,
} from "../../types/models";

const statusOrder: StudentStatus[] = ["active", "inactive"];
const genderOrder: Gender[] = ["F", "M"];

const pagerClass =
  "flex h-7 w-7 items-center justify-center rounded-full border border-base-content/15 bg-base-300 text-sm text-base-content/70 transition hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-base-content/15 disabled:hover:bg-base-300";

type Chip = {
  id: string;
  label: string;
  onRemove: () => void;
};

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function FilterSection({
  title,
  isAllSelected,
  onToggleAll,
  children,
}: {
  title: string;
  isAllSelected: boolean;
  onToggleAll: () => void;
  children: ReactNode;
}) {
  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-1.5 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40">
          {title}
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[11px] font-semibold text-base-content/45 transition hover:text-base-content"
        >
          {isAllSelected ? "Aucun" : "Tout"}
        </button>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function FilterOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-center gap-3 rounded-xl px-1.5 py-1.5 transition",
        checked ? "bg-base-content/10" : "hover:bg-base-content/5",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="checkbox checkbox-sm checkbox-primary shrink-0"
      />
      <span className="flex-1 text-sm text-base-content">{label}</span>
    </label>
  );
}

function StudentsListPage() {
  const [search, setSearch] = useState("");
  const [classIds, setClassIds] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<StudentStatus[]>(["active"]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [result, setResult] = useState<{ key: string; page: StudentPage } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const filtersRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const lastQueryKeyRef = useRef<string | null>(null);

  /** Filtres seuls : ni pagination ni page, pour comparer deux requêtes. */
  const filters = useMemo(
    () => ({
      search,
      classIds: [...classIds].sort((a, b) => a - b),
      statuses: statusOrder.filter((value) => statuses.includes(value)),
      genders: genderOrder.filter((value) => genders.includes(value)),
    }),
    [search, classIds, statuses, genders],
  );

  const filtersKey = JSON.stringify(filters);

  /** Nombre total de résultats du filtre courant, et pages correspondantes. */
  const total = result?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * Page réellement affichée : si un filtre réduit le nombre de résultats, l'état
   * peut pointer au-delà de la dernière page. On borne ici plutôt que par un
   * effet correcteur, ce qui évite un rendu en cascade.
   */
  const safePage = Math.min(page, totalPages);

  const query = useMemo(
    () => ({
      ...filters,
      limit: pageSize,
      offset: (safePage - 1) * pageSize,
    }),
    [filters, safePage, pageSize],
  );

  const key = JSON.stringify(query);
  const loading = result === null || result.key !== key;
  const students = useMemo(() => result?.page.rows ?? [], [result]);
  const firstRow = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastRow = total === 0 ? 0 : firstRow + students.length - 1;

  const chips = useMemo<Chip[]>(() => {
    const items: Chip[] = [];

    for (const id of query.classIds) {
      const classroom = classes.find((item) => item.id === id);

      items.push({
        id: `class-${id}`,
        label: classroom?.name ?? `Classe ${id}`,
        onRemove: () =>
          setClassIds((current) => current.filter((value) => value !== id)),
      });
    }

    if (statuses.length > 0 && statuses.length < statusOrder.length) {
      for (const value of statuses) {
        items.push({
          id: `status-${value}`,
          label: `Statut : ${statusLabels[value]}`,
          onRemove: () =>
            setStatuses((current) => current.filter((item) => item !== value)),
        });
      }
    }

    if (genders.length > 0 && genders.length < genderOrder.length) {
      for (const value of genders) {
        items.push({
          id: `gender-${value}`,
          label: `Sexe : ${genderLabel(value)}`,
          onRemove: () =>
            setGenders((current) => current.filter((item) => item !== value)),
        });
      }
    }

    return items;
  }, [query, classes, statuses, genders]);

  const clearFilters = () => {
    setClassIds([]);
    setStatuses([]);
    setGenders([]);
  };

  const selectedVisible = useMemo(
    () => students.filter((student) => selected.includes(student.id)),
    [students, selected],
  );
  const hasSelection = selected.length > 0;
  const allSelected =
    students.length > 0 && selectedVisible.length === students.length;
  const someSelected = selectedVisible.length > 0;
  const exportList = hasSelection ? selectedVisible : students;
  const canExport = !loading && exportList.length > 0;

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    const visibleIds = students.map((student) => student.id);

    setSelected((current) => {
      const everyVisibleSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) => current.includes(id));

      return everyVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])];
    });
  };

  // Une callback ref ne serait pas rappelée quand la sélection change : l'état
  // "indéterminé" resterait figé sur sa valeur initiale.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const handleExport = async () => {
    if (!canExport || exporting) {
      return;
    }

    setExporting(true);
    setError(null);
    setSaved(null);

    try {
      // Sans sélection, l'export porte sur l'intégralité du filtre et non sur la
      // seule page affichée : on recharge donc toutes les lignes correspondantes.
      const rows = hasSelection
        ? exportList
        : await listStudents({ ...filters, limit: 20_000, offset: 0 });

      const single = rows.length === 1;
      const stamp = new Date().toISOString().slice(0, 10);
      const filterLabels = chips.map((chip) => chip.label).join(", ");

      const path = await savePdf(
        single ? (
          <StudentProfileDocument student={rows[0]} />
        ) : (
          <StudentListDocument students={rows} filters={filterLabels} />
        ),
        single
          ? `fiche-${rows[0].matricule}.pdf`
          : `liste-eleves-${rows.length}-${stamp}.pdf`,
      );

      if (path) {
        setSaved(path);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (lastQueryKeyRef.current === filtersKey) {
      return;
    }

    // La sélection est indexée par identifiant : si un filtre change, des élèves
    // masqués resteraient sélectionnés et seraient inclus dans l'export, en
    // contradiction avec le compteur affiché. On revient aussi à la première
    // page : la pagination précédente n'a plus de sens.
    lastQueryKeyRef.current = filtersKey;
    setSelected([]);
    setPage(1);
  }, [filtersKey]);

  useEffect(() => {
    if (!filtersOpen) {
      return () => undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        filtersRef.current &&
        !filtersRef.current.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

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

    listStudentsPage(query)
      .then((rows) => {
        if (!cancelled) {
          setResult({ key, page: rows });
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            page: {
              rows: [],
              count: 0,
              total: 0,
              limit: pageSize,
              offset: query.offset,
            },
          });
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, key, pageSize]);

  const classesAllSelected =
    classes.length > 0 && classIds.length === classes.length;
  const statusesAllSelected = statuses.length === statusOrder.length;
  const gendersAllSelected = genders.length === genderOrder.length;

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

            <div ref={filtersRef} className="relative">
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
                onClick={() => setFiltersOpen((value) => !value)}
                className={clsx(
                  "flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                  chips.length > 0
                    ? "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-base-content/15 bg-base-300 text-base-content/70 hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
                Filtres
                {chips.length > 0 ? (
                  <span className="min-w-4 rounded-full bg-primary px-1.5 text-[11px] font-bold leading-4 text-primary-content">
                    {chips.length}
                  </span>
                ) : null}
              </button>

              {filtersOpen ? (
                <div
                  role="dialog"
                  aria-label="Filtres"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-base-content/10 bg-base-200 p-1.5 shadow-2xl"
                >
                  <div className="max-h-80 overflow-y-auto">
                    <FilterSection
                      title="Classes"
                      isAllSelected={classesAllSelected}
                      onToggleAll={() =>
                        setClassIds(
                          classesAllSelected
                            ? []
                            : classes.map((classroom) => classroom.id),
                        )
                      }
                    >
                      {classes.map((classroom) => (
                        <FilterOption
                          key={classroom.id}
                          label={classroom.name}
                          checked={classIds.includes(classroom.id)}
                          onChange={() =>
                            setClassIds((current) =>
                              toggleValue(current, classroom.id),
                            )
                          }
                        />
                      ))}
                    </FilterSection>

                    <FilterSection
                      title="Statut"
                      isAllSelected={statusesAllSelected}
                      onToggleAll={() =>
                        setStatuses(statusesAllSelected ? [] : [...statusOrder])
                      }
                    >
                      {statusOrder.map((value) => (
                        <FilterOption
                          key={value}
                          label={statusLabels[value]}
                          checked={statuses.includes(value)}
                          onChange={() =>
                            setStatuses((current) =>
                              toggleValue(current, value),
                            )
                          }
                        />
                      ))}
                    </FilterSection>

                    <FilterSection
                      title="Sexe"
                      isAllSelected={gendersAllSelected}
                      onToggleAll={() =>
                        setGenders(gendersAllSelected ? [] : [...genderOrder])
                      }
                    >
                      {genderOrder.map((value) => (
                        <FilterOption
                          key={value}
                          label={genderLabel(value)}
                          checked={genders.includes(value)}
                          onChange={() =>
                            setGenders((current) => toggleValue(current, value))
                          }
                        />
                      ))}
                    </FilterSection>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 border-t border-base-content/10 px-2 pt-2">
                    <span className="text-[11px] text-base-content/40">
                      Case vide = tout afficher
                    </span>
                    <button
                      type="button"
                      onClick={clearFilters}
                      disabled={chips.length === 0}
                      className="shrink-0 text-[11px] font-semibold text-base-content/60 transition hover:text-base-content disabled:opacity-30"
                    >
                      Tout effacer
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {hasSelection ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs font-medium text-base-content/45 underline-offset-2 transition hover:text-base-content hover:underline"
              >
                Vider la sélection ({selectedVisible.length})
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || exporting}
              className="flex h-9 items-center gap-2 rounded-full border border-base-content/15 bg-base-300 px-4 text-sm font-medium text-base-content/80 transition hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-base-content/15 disabled:hover:bg-base-300"
            >
              {exporting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="h-4 w-4" strokeWidth={1.5} />
              )}
              {exporting ? "Export…" : "Exporter"}
              {hasSelection ? (
                <span className="min-w-4 rounded-full bg-primary px-1.5 text-[11px] font-bold leading-4 text-primary-content">
                  {exportList.length}
                </span>
              ) : null}
            </button>

            <span className="ml-auto text-xs tabular-nums text-base-content/50">
              {loading
                ? "Chargement…"
                : total === 0
                  ? "Aucun élève"
                  : `${firstRow}–${lastRow} sur ${total} élève(s)`}
            </span>
          </div>

          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-base-content/40">
                Filtres actifs
              </span>
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1.5 rounded-full border border-base-content/15 bg-base-content/5 py-1 pl-3 pr-2 text-xs font-medium text-base-content/80 transition hover:border-error/40 hover:bg-error/10 hover:text-error"
                >
                  {chip.label}
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-base-content/45 underline-offset-2 transition hover:text-base-content hover:underline"
              >
                Tout effacer
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-box bg-error/10 px-4 py-3 text-sm text-error">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {error}
            </div>
          ) : null}

          {saved ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-box bg-success/10 px-4 py-3 text-sm text-success"
            >
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 break-all">PDF enregistré : {saved}</span>
              <button
                type="button"
                onClick={() => setSaved(null)}
                aria-label="Fermer la confirmation d'export"
                className="shrink-0 opacity-60 transition hover:opacity-100"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
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
              <Users className="h-8 w-8 text-base-content/30" strokeWidth={1.5} />
              <p className="text-sm font-medium text-base-content">
                Aucun élève trouvé
              </p>
              <p className="text-xs text-base-content/50">
                Modifie la recherche ou les filtres.
              </p>
            </div>
          ) : null}

          {!loading && students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        ref={selectAllRef}
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={students.length === 0}
                        aria-label="Sélectionner tous les élèves affichés"
                        className="checkbox checkbox-sm checkbox-primary"
                      />
                    </th>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Classe</th>
                    <th>Sexe</th>
                    <th>Naissance</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className={
                        selected.includes(student.id) ? "bg-base-content/5" : undefined
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(student.id)}
                          onChange={() => toggleSelected(student.id)}
                          aria-label={`Sélectionner ${student.lastName} ${student.firstName}`}
                          className="checkbox checkbox-sm checkbox-primary"
                        />
                      </td>
                      <td className="font-mono text-xs text-base-content/60">
                        {student.matricule}
                      </td>
                      <td className="font-medium text-base-content">
                        {student.lastName.toUpperCase()} {student.firstName}
                      </td>
                      <td className="text-base-content/70">
                        {student.className ?? "—"}
                      </td>
                      <td className="text-base-content/70">
                        {genderLabel(student.gender)}
                      </td>
                      <td className="text-base-content/70">
                        {student.birthDate ?? "—"}
                      </td>
                      <td>
                        <span
                          className={clsx(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusClass[student.status],
                          )}
                        >
                          {student.status === "active" ? "Actif" : "Sorti"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-content/10 pt-3">
              <label className="flex items-center gap-2 text-xs text-base-content/50">
                Lignes par page
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(Number(event.target.value) as PageSize)
                  }
                  aria-label="Nombre de lignes par page"
                  className="select select-xs bg-base-300 text-base-content"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-base-content/50">
                  Page {safePage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  aria-label="Première page"
                  className={pagerClass}
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  aria-label="Page précédente"
                  className={pagerClass}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage >= totalPages}
                  aria-label="Page suivante"
                  className={pagerClass}
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage >= totalPages}
                  aria-label="Dernière page"
                  className={pagerClass}
                >
                  »
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StudentsListPage;
