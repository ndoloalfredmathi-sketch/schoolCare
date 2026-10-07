import { useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, KeyRound } from "lucide-react";
import { changePassword } from "../../services/api";
import { errorMessage } from "../../lib/labels";
import { AuthCard, PasswordField } from "../../components/AuthForm";
import type { AuthState, AuthUser } from "../../types/models";

/**
 * Changement de mot de passe obligatoire à la première connexion du compte
 * d'administration livré avec un mot de passe de démonstration.
 */
function ChangePasswordScreen({
  user,
  onChanged,
}: {
  user: AuthUser;
  onChanged: (state: AuthState) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmation) {
      setError("Les deux saisies du nouveau mot de passe diffèrent.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const state = await changePassword(currentPassword, newPassword);
      onChanged(state);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle={`Compte ${user.displayName} — première connexion.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-box bg-warning/10 px-3 py-2 text-xs text-warning">
          Ce compte utilise encore le mot de passe de démonstration. Choisissez
          un mot de passe personnel pour continuer.
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-box bg-error/10 px-3 py-2 text-sm text-error">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="flex-1">{error}</span>
          </div>
        ) : null}

        <PasswordField
          label="Mot de passe actuel"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoFocus
        />

        <PasswordField
          label="Nouveau mot de passe"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="8 caractères minimum"
        />

        <PasswordField
          label="Confirmer le nouveau mot de passe"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary btn-sm mt-1 w-full"
        >
          {submitting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <KeyRound className="h-4 w-4" strokeWidth={1.5} />
          )}
          {submitting ? "Enregistrement…" : "Définir le mot de passe"}
        </button>
      </form>
    </AuthCard>
  );
}

export { ChangePasswordScreen };
