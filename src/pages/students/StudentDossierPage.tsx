import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  History,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteStudent,
  getStudent,
  listClasses,
  listStudentAudit,
} from "../../services/api";
import { savePdf } from "../../services/exportPdf";
import { StudentProfileDocument } from "../../pdf/studentDocuments";
import {
  errorMessage,
  genderLabel,
  initialsOf,
  statusClass,
  statusLabel,
} from "../../lib/labels";
import { StudentEditForm } from "./StudentEditForm";
import { StudentAbsencesCard } from "./StudentAbsencesCard";
import type { AuditEntry, ClassRoom, Student } from "../../types/models";

const actionLabels: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
};

function formatDateTime(value: string): string {
  // SQLite renvoie "AAAA-MM-JJ HH:MM:SS" en UTC.
  const parsed = new Date(`${value.replace(" ", "T")}Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-300 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40">
        {label}
      </p>
      <p
        className={clsx(
          "mt-1 text-sm text-base-content",
          mono && "font-mono text-xs text-base-content/70",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StudentDossierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const studentId = Number(id);

  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const isValidId = Number.isInteger(studentId);
  // État dérivé : pas besoin de `setLoaded` dans l'effet.
  const loading = isValidId && loadedId !== studentId;

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listClasses()
      .then((rows) => {
        if (!cancelled) {
          setClasses(rows);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isValidId) {
      return undefined;
    }

    getStudent(studentId)
      .then((row) => {
        if (!cancelled) {
          setStudent(row);
          setError(null);
          setLoadedId(studentId);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setStudent(null);
          setError(errorMessage(cause));
          setLoadedId(studentId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, isValidId, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    if (!isValidId) {
      return undefined;
    }

    listStudentAudit(studentId, 15)
      .then((rows) => {
        if (!cancelled) {
          setAudit(rows);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [studentId, isValidId, reloadToken]);

  const handleExport = async () => {
    if (!student || exporting) {
      return;
    }

    setExporting(true);
    setError(null);
    setSaved(null);

    try {
      const path = await savePdf(
        <StudentProfileDocument student={student} />,
        `fiche-${student.matricule}.pdf`,
      );

      if (path) {
        setSaved(path);
      }
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!student || deleting) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteStudent(student.id);
      navigate("/eleves/dossiers", { replace: true });
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const backLink = (
    <Link
      to="/eleves/dossiers"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/50 underline-offset-2 transition hover:text-base-content hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
      Retour aux dossiers
    </Link>
  );

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
    </>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="card border border-base-content/10 bg-base-200">
          <div className="card-body items-center justify-center gap-2 py-16 text-sm text-base-content/50">
            <span className="loading loading-spinner loading-sm" />
            Chargement du dossier…
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="card border border-base-content/10 bg-base-200">
          <div className="card-body items-center gap-3 py-16 text-center">
            <FileText
              className="h-8 w-8 text-base-content/30"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-base-content">
              Dossier introuvable
            </p>
            <p className="text-xs text-base-content/50">
              L'élève demandé n'existe plus.
            </p>
            {backLink}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-base-content/10 text-base font-semibold text-base-content/70">
                {initialsOf(student)}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-base-content">
                  {student.lastName.toUpperCase()} {student.firstName}
                </h2>
                <p className="font-mono text-xs text-base-content/50">
                  {student.matricule}
                </p>
              </div>
              <span
                className={clsx(
                  "ml-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                  statusClass[student.status],
                )}
              >
                {statusLabel(student.status)}
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              {backLink}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing((value) => !value);
                    setConfirmingDelete(false);
                    setNotice(null);
                  }}
                  className="flex h-9 items-center gap-2 rounded-full border border-base-content/15 bg-base-300 px-4 text-sm font-medium text-base-content/80 transition hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  {editing ? "Fermer l'édition" : "Modifier"}
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex h-9 items-center gap-2 rounded-full border border-base-content/15 bg-base-300 px-4 text-sm font-medium text-base-content/80 transition hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {exporting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Download className="h-4 w-4" strokeWidth={1.5} />
                  )}
                  {exporting ? "Export…" : "Exporter la fiche"}
                </button>
              </div>
            </div>
          </div>

          {alertBlock}

          {editing ? (
            <StudentEditForm
              key={`${student.id}:${student.updatedAt ?? ""}`}
              student={student}
              classes={classes}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setStudent(updated);
                setEditing(false);
                setNotice("Fiche mise à jour.");
                reload();
              }}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Classe" value={student.className ?? "Sans classe"} />
              <Field label="Sexe" value={genderLabel(student.gender)} />
              <Field
                label="Date de naissance"
                value={student.birthDate ?? "—"}
              />
              <Field label="Statut" value={statusLabel(student.status)} />
              <Field label="Matricule" value={student.matricule} mono />
              <Field label="Identifiant" value={String(student.id)} mono />
              <Field
                label="Inscrit le"
                value={student.createdAt ? formatDateTime(student.createdAt) : "—"}
              />
              <Field
                label="Dernière modification"
                value={
                  student.updatedAt ? formatDateTime(student.updatedAt) : "—"
                }
              />
            </div>
          )}
        </div>
      </div>

      <StudentAbsencesCard studentId={student.id} refreshToken={reloadToken} />

      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-4 p-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-base-content/60" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-base-content">
              Historique des modifications
            </h3>
            <span className="ml-auto text-xs text-base-content/45">
              {audit.length} entrée(s)
            </span>
          </div>

          {audit.length === 0 ? (
            <p className="text-xs text-base-content/50">
              Aucune modification enregistrée pour cet élève.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Date</th>
                    <th>Par</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-base-content/80">
                        {actionLabels[entry.action] ?? entry.action}
                      </td>
                      <td className="whitespace-nowrap text-base-content/60">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="font-mono text-xs text-base-content/50">
                        {entry.actor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card border border-error/25 bg-base-200">
        <div className="card-body gap-3 p-5">
          <h3 className="text-sm font-semibold text-error">Zone sensible</h3>

          {confirmingDelete ? (
            <div className="flex flex-col gap-3 rounded-box bg-error/10 p-4">
              <p className="text-sm text-base-content">
                Confirmer la suppression définitive de{" "}
                <strong>
                  {student.lastName.toUpperCase()} {student.firstName}
                </strong>{" "}
                ({student.matricule}) ? L'opération est journalisée mais
                irréversible depuis l'application.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn btn-error btn-sm"
                >
                  {deleting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  )}
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="btn btn-ghost btn-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-base-content/50">
                La suppression retire l'élève de la base. Elle est tracée dans
                l'historique mais ne peut pas être annulée ici.
              </p>

              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex h-9 items-center gap-2 rounded-full border border-error/40 px-4 text-sm font-medium text-error transition hover:bg-error/10"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Supprimer cet élève
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDossierPage;
