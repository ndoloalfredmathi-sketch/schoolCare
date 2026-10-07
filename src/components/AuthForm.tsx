import type { ReactNode } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";

/** Carte plein écran utilisée par les écrans d'authentification. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-base-100 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-content">
            S
          </span>
          <div>
            <h1 className="text-lg font-semibold text-base-content">{title}</h1>
            <p className="mt-1 text-xs text-base-content/50">{subtitle}</p>
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-200">
          <div className="card-body gap-4 p-5">{children}</div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-base-content/35">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          Données locales, jamais transmises à un serveur
        </p>
      </div>
    </div>
  );
}

/** Champ mot de passe avec révélation temporaire. */
export function PasswordField({
  label,
  value,
  onChange,
  autoFocus,
  autoComplete = "current-password",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-base-content/60">{label}</span>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="input input-sm w-full bg-base-300 pr-10 text-base-content placeholder:text-base-content/30"
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-base-content/40 transition hover:text-base-content"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
}
