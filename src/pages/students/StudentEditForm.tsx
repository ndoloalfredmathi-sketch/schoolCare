import { useState } from "react";
import type { FormEvent } from "react";
import clsx from "clsx";
import { CircleAlert, CircleCheck, Save, UserPen, X } from "lucide-react";
import { updateStudent } from "../../services/api";
import { errorMessage, genderLabel } from "../../lib/labels";
import type { ClassRoom, Gender, Student } from "../../types/models";

const genderOrder: Gender[] = ["F", "M"];

type StudentEditFormProps = {
  student: Student;
  classes: ClassRoom[];
  onSaved: (student: Student) => void;
  onCancel: () => void;
};

/**
 * Formulaire de modification de la fiche élève. Le matricule n'est pas
 * modifiable : il sert d'identifiant externe (dossiers, documents, exports).
 *
 * Le formulaire est initialisé depuis `student`. Le parent doit lui fournir une
 * `key` incluant `student.id` et `student.updatedAt` : c'est ce remontage qui
 * réinitialise les champs, plutôt qu'un effet de synchronisation.
 */
function StudentEditForm({
  student,
  classes,
  onSaved,
  onCancel,
}: StudentEditFormProps) {
  const [lastName, setLastName] = useState(student.lastName);
  const [firstName, setFirstName] = useState(student.firstName);
  const [gender, setGender] = useState<Gender>(student.gender);
  const [birthDate, setBirthDate] = useState(student.birthDate ?? "");
  const [classId, setClassId] = useState(
    student.classId === null ? "" : String(student.classId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!lastName.trim() || !firstName.trim()) {
      setError("Le nom et le prénom sont obligatoires.");
      return;
    }

    if (!classId) {
      setError("La classe est obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateStudent(student.id, {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        gender,
        birthDate: birthDate || null,
        classId: Number(classId),
      });

      onSaved(updated);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "input input-sm w-full bg-base-300 text-base-content placeholder:text-base-content/30";
  const labelClass = "text-xs font-medium text-base-content/60";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-box border border-base-content/10 bg-base-300 p-4"
    >
      <div className="flex items-center gap-2">
        <UserPen className="h-4 w-4 text-base-content/60" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-base-content">
          Modifier la fiche
        </h3>
        <span className="ml-auto font-mono text-xs text-base-content/45">
          {student.matricule}
        </span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-box bg-error/10 px-3 py-2 text-sm text-error">
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Nom</span>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            autoComplete="off"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Prénom</span>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            autoComplete="off"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Sexe</span>
          <div role="radiogroup" aria-label="Sexe" className="grid grid-cols-2 gap-2">
            {genderOrder.map((value) => (
              <label
                key={value}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition",
                  gender === value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-base-content/15 bg-base-200 text-base-content/70 hover:border-base-content/30",
                )}
              >
                <input
                  type="radio"
                  name="edit-gender"
                  className="radio radio-primary radio-sm"
                  checked={gender === value}
                  onChange={() => setGender(value)}
                />
                {genderLabel(value)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Date de naissance</span>
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
            className="select select-sm w-full bg-base-200 text-base-content"
          >
            <option value="">Choisir une classe…</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Save className="h-4 w-4" strokeWidth={1.5} />
          )}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="btn btn-ghost btn-sm"
        >
          Annuler
        </button>

        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-base-content/40">
          <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          Toute modification est journalisée
        </span>
      </div>
    </form>
  );
}

export { StudentEditForm };
