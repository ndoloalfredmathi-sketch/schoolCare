import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, LogIn } from "lucide-react";
import { getAuthState, listAccounts, login } from "../../services/api";
import { errorMessage } from "../../lib/labels";
import { AuthCard, PasswordField } from "../../components/AuthForm";
import type { AccountOption, AuthState } from "../../types/models";

function LoginScreen({ onAuthenticated }: { onAuthenticated: (state: AuthState) => void }) {
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAccounts()
      .then((rows) => {
        if (cancelled) {
          return;
        }

        setAccounts(rows);
        setUserId(rows[0]?.id ?? null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setAccounts([]);
          setError(errorMessage(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting || userId === null) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const state = await login(userId, password);
      setPassword("");
      onAuthenticated(state);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  if (accounts === null) {
    return (
      <AuthCard title="SchoolCare" subtitle="Chargement des comptes…">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-base-content/50">
          <span className="loading loading-spinner loading-sm" />
          Chargement…
        </div>
      </AuthCard>
    );
  }

  if (accounts.length === 0) {
    return (
      <AuthCard
        title="Aucun compte"
        subtitle="Aucun utilisateur actif n'est configuré."
      >
        <p className="text-sm text-base-content/70">
          Aucun compte actif n'est disponible dans cette base. Restaurez une
          sauvegarde ou contactez l'administrateur.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Connexion"
      subtitle="Sélectionnez votre compte et saisissez votre mot de passe."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <div className="flex items-center gap-2 rounded-box bg-error/10 px-3 py-2 text-sm text-error">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="flex-1">{error}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-account"
            className="text-xs font-medium text-base-content/60"
          >
            Compte
          </label>
          <select
            id="login-account"
            value={userId ?? ""}
            onChange={(event) => setUserId(Number(event.target.value))}
            className="select select-sm w-full bg-base-300 text-base-content"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.displayName}
              </option>
            ))}
          </select>
        </div>

        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoFocus
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary btn-sm mt-1 w-full"
        >
          {submitting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <LogIn className="h-4 w-4" strokeWidth={1.5} />
          )}
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </AuthCard>
  );
}

/** Écran de verrouillage : la session a expiré ou l'utilisateur s'est déconnecté. */
function LockedScreen() {
  const [state, setState] = useState<AuthState | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAuthState()
      .then((next) => {
        if (!cancelled) {
          setState(next);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (state?.user) {
    return (
      <AuthCard
        title="Session verrouillée"
        subtitle="Reconnectez-vous pour continuer."
      >
        <p className="text-sm text-base-content/70">
          La session de {state.user.displayName} a été verrouillée.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Déconnexion" subtitle="Reconnectez-vous pour continuer.">
      <p className="text-sm text-base-content/70">
        Vous avez été déconnecté.
      </p>
    </AuthCard>
  );
}

export { LoginScreen, LockedScreen };
