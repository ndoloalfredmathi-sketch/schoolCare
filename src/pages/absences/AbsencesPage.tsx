import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarCheck,
  CalendarX,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  History,
  Trash2,
  X,
} from "lucide-react";
import {
  ABSENCE_PERIOD_LABELS,
  ABSENCE_PERIODS,
} from "../../types/models";
import type {
  Absence,
  AbsencePeriod,
  AttendanceRow,
  ClassRoom,
} from "../../types/models";
import {
  deleteAbsence,
  listAbsences,
  listAttendance,
  listClasses,
  toggleAbsence,
  updateAbsence,
} from "../../services/api";
import { errorMessage } from "../../lib/labels";

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("fr-FR", { dateStyle: "short" });
}

/** Décale une date AAAA-MM-JJ de `days` jours. */
function shiftDate(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);

  const offset = parsed.getTimezoneOffset() * 60_000;

  return new Date(parsed.getTime() - offset).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Saisie rapide                                                              */
/* -------------------------------------------------------------------------- */

function AttendanceGrid({
  classId,
  date,
  onError,
  onChanged,
}: {
  classId: number;
  date: string;
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [result, setResult] = useState<{ key: string; rows: AttendanceRow[] } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // État indexé par la paire (classe, date) : pas de remise à zéro dans l'effet.
  const key = JSON.stringify({ classId, date });
  const loading = result === null || result.key !== key;
  const rows = loading ? null : result.rows;

  useEffect(() => {
    let cancelled = false;

    listAttendance(classId, date)
      .then((rows) => {
        if (!cancelled) {
          setResult({ key, rows });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ key, rows: [] });
          onError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [classId, date, key, onError]);

  const toggle = async (row: AttendanceRow, period: AbsencePeriod) => {
    const cellKey = `${row.studentId}:${period}`;

    if (busy) {
      return;
    }

    setBusy(cellKey);
    onError(null);

    try {
      // Marquer une journée entière remplace les demi-journées existantes.
      if (period === "full" && row.periods.includes("full")) {
        await deleteFullDay(row);
      } else {
        await toggleAbsence({
          studentId: row.studentId,
          date,
          period,
          justified: row.justified,
          reason: reason.trim() || row.reason,
        });
      }

      setResult({ key, rows: await listAttendance(classId, date) });
      onChanged();
    } catch (cause: unknown) {
      onError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  /** Retire une journée entière en effaçant chacune de ses lignes. */
  const deleteFullDay = async (row: AttendanceRow) => {
    const existing = await listAbsences({ studentId: row.studentId, from: date, to: date });

    for (const absence of existing) {
      await deleteAbsence(absence.id);
    }
  };

  const justify = async (row: AttendanceRow, justified: boolean) => {
    const cellKey = `${row.studentId}:justify`;

    if (busy) {
      return;
    }

    setBusy(cellKey);
    onError(null);

    try {
      const existing = await listAbsences({
        studentId: row.studentId,
        from: date,
        to: date,
      });

      for (const absence of existing) {
        await updateAbsence(absence.id, {
          studentId: absence.studentId,
          date: absence.date,
          period: absence.period,
          justified,
          reason: absence.reason,
        });
      }

      setResult({ key, rows: await listAttendance(classId, date) });
      onChanged();
    } catch (cause: unknown) {
      onError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  if (rows === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-base-content/50">
        <span className="loading loading-spinner loading-sm" />
        Chargement des élèves…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <ClipboardCheck className="h-8 w-8 text-base-content/30" strokeWidth={1.5} />
        <p className="text-sm font-medium text-base-content">
          Aucun élève actif dans cette classe
        </p>
        <p className="text-xs text-base-content/50">
          Inscrivez des élèves ou choisissez une autre classe.
        </p>
      </div>
    );
  }

  const absentCount = rows.filter((row) => row.periods.length > 0).length;

  const cellClass = (marked: boolean, isBusy: boolean) =>
    clsx(
      "flex h-7 min-w-14 items-center justify-center rounded-full border px-2 text-xs font-medium transition",
      marked
        ? "border-transparent bg-error text-error-content"
        : "border-base-content/15 bg-base-300 text-base-content/50 hover:border-base-content/30 hover:text-base-content",
      isBusy && "opacity-40",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-base-content/60">
          Motif à appliquer
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Maladie, rendez-vous…"
            maxLength={200}
            className="input input-xs w-56 bg-base-300 text-base-content placeholder:text-base-content/30"
          />
        </label>

        <span className="ml-auto text-xs tabular-nums text-base-content/50">
          {absentCount} absent(s) sur {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Élève</th>
              <th>Matricule</th>
              {ABSENCE_PERIODS.map((period) => (
                <th key={period} className="text-center">
                  {ABSENCE_PERIOD_LABELS[period]}
                </th>
              ))}
              <th className="text-center">Justifiée</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAbsent = row.periods.length > 0;
              const fullDay = row.periods.includes("full");

              return (
                <tr key={row.studentId} className={isAbsent ? "bg-error/5" : undefined}>
                  <td className="font-medium text-base-content">
                    {row.lastName.toUpperCase()} {row.firstName}
                  </td>
                  <td className="font-mono text-xs text-base-content/50">
                    {row.matricule}
                  </td>

                  {ABSENCE_PERIODS.map((period) => {
                    // Une journée entière marque aussi le matin et l'après-midi.
                    const marked =
                      row.periods.includes(period) ||
                      (fullDay && (period === "am" || period === "pm"));

                    return (
                      <td key={period} className="text-center">
                        <button
                          type="button"
                          onClick={() => void toggle(row, period)}
                          disabled={busy !== null}
                          aria-pressed={marked}
                          aria-label={`${ABSENCE_PERIOD_LABELS[period]} — ${row.lastName} ${row.firstName}`}
                          className={cellClass(marked, busy === `${row.studentId}:${period}`)}
                        >
                          {marked ? "Absent" : "Présent"}
                        </button>
                      </td>
                    );
                  })}

                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => void justify(row, !row.justified)}
                      disabled={!isAbsent || busy !== null}
                      aria-pressed={isAbsent && row.justified}
                      aria-label={`Justification — ${row.lastName} ${row.firstName}`}
                      className={clsx(
                        "flex h-7 min-w-20 items-center justify-center rounded-full border px-2 text-xs font-medium transition",
                        !isAbsent
                          ? "border-base-content/10 bg-base-300 text-base-content/25"
                          : row.justified
                            ? "border-transparent bg-success text-success-content"
                            : "border-base-content/15 bg-base-300 text-base-content/50 hover:border-base-content/30 hover:text-base-content",
                      )}
                    >
                      {isAbsent && row.justified ? "Justifiée" : "Non justifiée"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Historique                                                                 */
/* -------------------------------------------------------------------------- */

function AbsenceHistory({
  classes,
  onError,
  refreshToken,
}: {
  classes: ClassRoom[];
  onError: (message: string | null) => void;
  refreshToken: number;
}) {
  const [from, setFrom] = useState(() => shiftDate(today(), -30));
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState("");
  const [result, setResult] = useState<{ key: string; rows: Absence[] } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<number | null>(null);

  const query = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      classIds: classId ? [Number(classId)] : undefined,
      limit: 300,
    }),
    [from, to, classId],
  );

  const key = `${JSON.stringify(query)}:${refreshToken}`;
  const loading = result === null || result.key !== key;
  const entries = loading ? null : result.rows;

  useEffect(() => {
    let cancelled = false;

    listAbsences(query)
      .then((rows) => {
        if (!cancelled) {
          setResult({ key, rows });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ key, rows: [] });
          onError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, key, onError]);

  const remove = async (absence: Absence) => {
    if (deleting !== null) {
      return;
    }

    setDeleting(absence.id);
    onError(null);

    try {
      await deleteAbsence(absence.id);
      setResult((current) =>
        current === null
          ? current
          : {
              key: current.key,
              rows: current.rows.filter((entry) => entry.id !== absence.id),
            },
      );
    } catch (cause: unknown) {
      onError(errorMessage(cause));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-base-content/60">Du</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="input input-sm bg-base-300 text-base-content"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-base-content/60">Au</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="input input-sm bg-base-300 text-base-content"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-base-content/60">Classe</span>
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="select select-sm bg-base-300 text-base-content"
          >
            <option value="">Toutes les classes</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setFrom(today());
            setTo(today());
          }}
          className="btn btn-ghost btn-sm"
        >
          Aujourd'hui
        </button>

        <span className="ml-auto text-xs tabular-nums text-base-content/50">
          {entries === null ? "Chargement…" : `${entries.length} absence(s)`}
        </span>
      </div>

      {entries === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-base-content/50">
          <span className="loading loading-spinner loading-sm" />
          Chargement…
        </div>
      ) : null}

      {entries !== null && entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CalendarCheck className="h-8 w-8 text-base-content/30" strokeWidth={1.5} />
          <p className="text-sm font-medium text-base-content">
            Aucune absence sur cette période
          </p>
          <p className="text-xs text-base-content/50">
            Modifiez les dates ou choisissez une autre classe.
          </p>
        </div>
      ) : null}

      {entries !== null && entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Élève</th>
                <th>Classe</th>
                <th>Demi-journée</th>
                <th>Justification</th>
                <th>Motif</th>
                <th>Saisi par</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {entries.map((absence) => (
                <tr key={absence.id}>
                  <td className="whitespace-nowrap text-base-content/70">
                    {formatShortDate(absence.date)}
                  </td>
                  <td className="font-medium text-base-content">
                    {absence.lastName.toUpperCase()} {absence.firstName}
                  </td>
                  <td className="text-base-content/70">
                    {absence.className ?? "—"}
                  </td>
                  <td className="text-base-content/70">
                    {ABSENCE_PERIOD_LABELS[absence.period]}
                  </td>
                  <td>
                    <span
                      className={clsx(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        absence.justified
                          ? "bg-success/15 text-success"
                          : "bg-warning/15 text-warning",
                      )}
                    >
                      {absence.justified ? "Justifiée" : "Non justifiée"}
                    </span>
                  </td>
                  <td className="max-w-48 truncate text-base-content/60">
                    {absence.reason ?? "—"}
                  </td>
                  <td className="font-mono text-xs text-base-content/45">
                    {absence.recordedBy}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void remove(absence)}
                      disabled={deleting !== null}
                      aria-label={`Supprimer l'absence du ${absence.date}`}
                      className="rounded-full p-1.5 text-base-content/35 transition hover:bg-error/10 hover:text-error disabled:opacity-40"
                    >
                      {deleting === absence.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function AbsencesPage() {
  const [mode, setMode] = useState<"saisie" | "historique">("saisie");
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleError = useCallback((message: string | null) => {
    setError(message);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listClasses()
      .then((rows) => {
        if (cancelled) {
          return;
        }

        setClasses(rows);
        // Première classe sélectionnée par défaut : la saisie est immédiate.
        setClassId((current) => current || (rows[0] ? String(rows[0].id) : ""));
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

  const alertBlock = (
    <>
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

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-box bg-success/10 px-4 py-3 text-sm text-success"
        >
          <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fermer la confirmation"
            className="shrink-0 opacity-60 transition hover:opacity-100"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      ) : null}
    </>
  );

  const modeButton = (value: "saisie" | "historique") =>
    clsx(
      "flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
      mode === value
        ? "bg-primary text-primary-content"
        : "text-base-content/60 hover:text-base-content",
    );

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-base-300 p-1">
              <button
                type="button"
                onClick={() => setMode("saisie")}
                className={modeButton("saisie")}
              >
                <ClipboardCheck className="h-4 w-4" strokeWidth={1.5} />
                Saisie du jour
              </button>
              <button
                type="button"
                onClick={() => setMode("historique")}
                className={modeButton("historique")}
              >
                <History className="h-4 w-4" strokeWidth={1.5} />
                Historique
              </button>
            </div>

            {mode === "saisie" ? (
              <>
                <label className="flex items-center gap-2 text-xs text-base-content/60">
                  Classe
                  <select
                    value={classId}
                    onChange={(event) => setClassId(event.target.value)}
                    aria-label="Classe"
                    className="select select-sm bg-base-300 text-base-content"
                  >
                    {classes.length === 0 ? <option value="">Aucune classe</option> : null}
                    {classes.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDate((current) => shiftDate(current, -1))}
                    aria-label="Jour précédent"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-base-content/15 bg-base-300 text-base-content/70 transition hover:border-base-content/30 hover:text-base-content"
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    aria-label="Date de la saisie"
                    className="input input-sm bg-base-300 text-base-content"
                  />
                  <button
                    type="button"
                    onClick={() => setDate((current) => shiftDate(current, 1))}
                    aria-label="Jour suivant"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-base-content/15 bg-base-300 text-base-content/70 transition hover:border-base-content/30 hover:text-base-content"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(today())}
                    className="btn btn-ghost btn-sm"
                  >
                    Aujourd'hui
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {alertBlock}

          {mode === "saisie" ? (
            classId === "" ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarX className="h-8 w-8 text-base-content/30" strokeWidth={1.5} />
                <p className="text-sm font-medium text-base-content">
                  Aucune classe disponible
                </p>
                <p className="text-xs text-base-content/50">
                  Créez d'abord une classe pour saisir les absences.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-base-content/45">
                  {formatDate(date)} — cliquez sur une demi-journée pour basculer
                  présence et absence. Une journée entière marque le matin et
                  l'après-midi.
                </p>

                <AttendanceGrid
                  classId={Number(classId)}
                  date={date}
                  onError={handleError}
                  onChanged={() => setRefreshToken((token) => token + 1)}
                />
              </>
            )
          ) : (
            <AbsenceHistory
              classes={classes}
              onError={handleError}
              refreshToken={refreshToken}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AbsencesPage;
