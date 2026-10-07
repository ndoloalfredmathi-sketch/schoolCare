import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import { getAbsenceSummary, listAbsences } from "../../services/api";
import { errorMessage } from "../../lib/labels";
import { ABSENCE_PERIOD_LABELS } from "../../types/models";
import type { Absence, AbsenceSummary } from "../../types/models";

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("fr-FR", { dateStyle: "short" });
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-300 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? "text-base-content"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Suivi des absences d'un élève : les compteurs d'abord, puis les
 * enregistrements récents. `refreshToken` permet au parent de forcer un
 * rechargement après une modification.
 */
function StudentAbsencesCard({
  studentId,
  refreshToken,
}: {
  studentId: number;
  refreshToken: number;
}) {
  const [summary, setSummary] = useState<AbsenceSummary | null>(null);
  const [entries, setEntries] = useState<Absence[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getAbsenceSummary(studentId),
      listAbsences({ studentId, limit: 10 }),
    ])
      .then(([nextSummary, nextEntries]) => {
        if (!cancelled) {
          setSummary(nextSummary);
          setEntries(nextEntries);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSummary(null);
          setEntries([]);
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, refreshToken]);

  return (
    <div className="card border border-base-content/10 bg-base-200">
      <div className="card-body gap-4 p-5">
        <div className="flex items-center gap-2">
          <CalendarX className="h-4 w-4 text-base-content/60" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-base-content">Absences</h3>
          <span className="ml-auto text-xs text-base-content/45">
            {summary === null ? "…" : `${summary.total} enregistrement(s)`}
          </span>
        </div>

        {error ? (
          <div className="rounded-box bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}

        {summary === null && !error ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-base-content/50">
            <span className="loading loading-spinner loading-sm" />
            Chargement…
          </div>
        ) : null}

        {summary !== null ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Demi-journées" value={summary.halfDays} />
              <Stat label="Justifiées" value={summary.justified} tone="text-success" />
              <Stat
                label="Non justifiées"
                value={summary.unjustified}
                tone="text-warning"
              />
              <Stat label="Enregistrements" value={summary.total} />
            </div>

            {entries.length === 0 ? (
              <p className="text-xs text-base-content/50">
                Aucune absence enregistrée pour cet élève.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Demi-journée</th>
                      <th>Justification</th>
                      <th>Motif</th>
                      <th>Saisi par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((absence) => (
                      <tr key={absence.id}>
                        <td className="whitespace-nowrap text-base-content/70">
                          {formatShortDate(absence.date)}
                        </td>
                        <td className="text-base-content/70">
                          {ABSENCE_PERIOD_LABELS[absence.period]}
                        </td>
                        <td>
                          <span
                            className={
                              absence.justified
                                ? "inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                                : "inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                            }
                          >
                            {absence.justified ? "Justifiée" : "Non justifiée"}
                          </span>
                        </td>
                        <td className="max-w-40 truncate text-base-content/60">
                          {absence.reason ?? "—"}
                        </td>
                        <td className="font-mono text-xs text-base-content/45">
                          {absence.recordedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export { StudentAbsencesCard };
