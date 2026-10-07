import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  CircleAlert,
  CircleCheck,
  DatabaseBackup,
  Download,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  createBackup,
  exportBackup,
  listBackups,
  restoreBackup,
} from "../../services/api";
import { errorMessage } from "../../lib/labels";
import type { BackupInfo } from "../../types/models";

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} o`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} Ko`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SettingsPage() {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [busy, setBusy] = useState<"create" | "export" | "restore" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBackups(await listBackups());
    } catch (cause: unknown) {
      setBackups([]);
      setError(errorMessage(cause));
    }
  }, []);

  // Chargement initial : un abonnement à une source externe (le disque).
  useEffect(() => {
    let cancelled = false;

    listBackups()
      .then((rows) => {
        if (!cancelled) {
          setBackups(rows);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setBackups([]);
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (
    kind: "create" | "export" | "restore",
    action: () => Promise<string | null>,
  ) => {
    if (busy) {
      return;
    }

    setBusy(kind);
    setNotice(null);
    setError(null);

    try {
      const message = await action();

      if (message) {
        setNotice(message);
      }

      await load();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () =>
    run("create", async () => {
      const created = await createBackup();
      return `Sauvegarde créée : ${created.fileName}`;
    });

  const handleExport = () =>
    run("export", async () => {
      const exported = await exportBackup();

      return exported
        ? `Sauvegarde enregistrée dans ${exported.path}`
        : null;
    });

  const handleRestore = () =>
    run("restore", async () => {
      const result = await restoreBackup();

      if (result.status === "invalid") {
        throw new Error(result.reason);
      }

      if (result.status === "restored") {
        return `Base restaurée. Copie de sécurité : ${result.safetyCopy}`;
      }

      return null;
    });

  const actionClass =
    "flex h-9 items-center gap-2 rounded-full border border-base-content/15 bg-base-300 px-4 text-sm font-medium text-base-content/80 transition hover:border-base-content/30 hover:bg-base-content/10 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-base-content/10">
              <ShieldCheck className="h-4 w-4 text-base-content/70" strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-base-content">
                Sauvegarde et restauration
              </h2>
              <p className="text-xs text-base-content/50">
                Une sauvegarde automatique est créée une fois par jour au
                démarrage, et les sept dernières sont conservées.
              </p>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-box bg-error/10 px-4 py-3 text-sm text-error">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {error}
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-box bg-success/10 px-4 py-3 text-sm text-success"
            >
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 break-all">{notice}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy !== null}
              className={actionClass}
            >
              {busy === "create" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <DatabaseBackup className="h-4 w-4" strokeWidth={1.5} />
              )}
              Créer une sauvegarde
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={busy !== null}
              className={actionClass}
            >
              {busy === "export" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="h-4 w-4" strokeWidth={1.5} />
              )}
              Enregistrer une copie…
            </button>

            <button
              type="button"
              onClick={handleRestore}
              disabled={busy !== null}
              className={clsx(
                actionClass,
                "border-warning/40 text-warning hover:border-warning/60 hover:bg-warning/10 hover:text-warning",
              )}
            >
              {busy === "restore" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <HardDriveDownload className="h-4 w-4" strokeWidth={1.5} />
              )}
              Restaurer une sauvegarde…
            </button>
          </div>

          <p className="flex items-start gap-2 text-xs text-base-content/45">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            La restauration remplace les données actuelles. Une copie de sécurité
            de la base existante est toujours créée avant le remplacement, et
            l'application redémarre ensuite.
          </p>
        </div>
      </div>

      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-base-content">
              Sauvegardes disponibles
            </h3>
            <span className="text-xs tabular-nums text-base-content/45">
              {backups === null ? "…" : `${backups.length} fichier(s)`}
            </span>
          </div>

          {backups === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-base-content/50">
              <span className="loading loading-spinner loading-sm" />
              Chargement…
            </div>
          ) : null}

          {backups !== null && backups.length === 0 ? (
            <p className="py-6 text-center text-xs text-base-content/50">
              Aucune sauvegarde pour le moment.
            </p>
          ) : null}

          {backups !== null && backups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Fichier</th>
                    <th>Date</th>
                    <th className="text-right">Taille</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((entry) => (
                    <tr key={entry.path}>
                      <td className="font-mono text-xs text-base-content/70">
                        {entry.fileName}
                      </td>
                      <td className="whitespace-nowrap text-base-content/60">
                        {formatDateTime(entry.modifiedAt)}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-base-content/60">
                        {formatBytes(entry.size)}
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
  );
}

export default SettingsPage;
