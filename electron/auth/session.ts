import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../db/index.js";
import { hashPassword, verifyPassword } from "./password.js";
import type {
  AccountOption,
  AuthState,
  AuthUser,
  RoleKey,
} from "../../src/types/models.js";

/** Durée d'inactivité avant verrouillage automatique. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Verrouillage temporaire après plusieurs échecs. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

type UserRow = {
  id: number;
  display_name: string;
  email: string | null;
  role_key: string;
  is_active: number;
  password_hash: string | null;
  must_change_password: number;
};

type Session = {
  user: AuthUser;
  lastActivityAt: number;
};

let session: Session | null = null;

const attempts = new Map<number, { count: number; lockedUntil: number }>();

/** Ferme la session et remet à zéro les compteurs de tentatives. */
function clearSession(): void {
  session = null;
  attempts.clear();
}

function isRoleKey(value: string): value is RoleKey {
  return ["admin", "teacher", "parent", "student"].includes(value);
}

const USER_COLUMNS = `u.id, u.display_name, u.email, u.is_active, u.password_hash,
              u.must_change_password, r.key AS role_key`;

const USER_JOIN = `FROM users u JOIN roles r ON r.id = u.role_id`;

function toUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: isRoleKey(row.role_key) ? row.role_key : "student",
    mustChangePassword: row.must_change_password === 1,
  };
}

/** Un utilisateur par identifiant, ou null s'il n'existe pas. */
function findUser(database: DatabaseSync, id: number): UserRow | null {
  const row = database
    .prepare(`SELECT ${USER_COLUMNS} ${USER_JOIN} WHERE u.id = ?`)
    .get(id) as UserRow | undefined;

  return row ?? null;
}

/** Acteur courant pour le journal d'audit : l'utilisateur connecté. */
export function currentActor(): string {
  if (!session) {
    return "anonyme";
  }

  return session.user.email ?? session.user.displayName;
}

function requireSession(): Session {
  if (!session) {
    throw new Error("Session expirée : reconnectez-vous.");
  }

  return session;
}

function touch(current: Session): void {
  current.lastActivityAt = Date.now();
}

export function listAccounts(): AccountOption[] {
  const rows = getDatabase()
    .prepare(
      `SELECT ${USER_COLUMNS} ${USER_JOIN}
        WHERE u.is_active = 1
        ORDER BY r.id, u.display_name COLLATE NOCASE`,
    )
    .all() as UserRow[];

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: isRoleKey(row.role_key) ? row.role_key : "student",
  }));
}

export function login(userId: number, password: string): AuthState {
  const database = getDatabase();
  const entry = attempts.get(userId);

  if (entry && entry.lockedUntil > Date.now()) {
    throw new Error(
      `Trop de tentatives. Réessayez dans ${Math.ceil(
        (entry.lockedUntil - Date.now()) / 1000,
      )} seconde(s).`,
    );
  }

  const row = findUser(database, userId);

  if (!row || row.is_active !== 1 || !row.password_hash) {
    throw new Error("Compte inconnu ou désactivé.");
  }

  if (!verifyPassword(password, row.password_hash)) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(userId, {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
    });

    throw new Error(
      count >= MAX_ATTEMPTS
        ? "Trop de tentatives. Compte verrouillé 30 secondes."
        : `Mot de passe incorrect (${count}/${MAX_ATTEMPTS}).`,
    );
  }

  attempts.delete(userId);

  database
    .prepare(
      "UPDATE users SET last_login_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?",
    )
    .run(userId);

  session = { user: toUser(row), lastActivityAt: Date.now() };

  return getAuthState();
}

export function logout(): AuthState {
  clearSession();

  return getAuthState();
}

/** Verrouille la session si elle a expiré par inactivité. */
function dropIfIdle(): void {
  if (session && Date.now() - session.lastActivityAt > IDLE_TIMEOUT_MS) {
    console.log("Session verrouillée après inactivité.");
    session = null;
  }
}

export function getAuthState(): AuthState {
  dropIfIdle();

  return {
    authenticated: session !== null,
    user: session?.user ?? null,
  };
}

/** Un utilisateur connecté mais devant changer son mot de passe. */
export function getPendingUser(): AuthUser | null {
  dropIfIdle();

  if (!session || !session.user.mustChangePassword) {
    return null;
  }

  return session.user;
}

export function requireAuthenticated(): AuthUser {
  const current = requireSession();

  if (current.user.mustChangePassword) {
    throw new Error("Vous devez définir un nouveau mot de passe.");
  }

  touch(current);

  return current.user;
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): AuthState {
  const current = requireSession();
  const database = getDatabase();

  if (newPassword.length < 8) {
    throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  }

  if (newPassword === currentPassword) {
    throw new Error("Le nouveau mot de passe doit être différent de l'actuel.");
  }

  const row = findUser(database, current.user.id);

  if (!row?.password_hash || !verifyPassword(currentPassword, row.password_hash)) {
    throw new Error("Le mot de passe actuel est incorrect.");
  }

  database
    .prepare(
      `UPDATE users
          SET password_hash = ?, must_change_password = 0
        WHERE id = ?`,
    )
    .run(hashPassword(newPassword), current.user.id);

  session = {
    user: { ...current.user, mustChangePassword: false },
    lastActivityAt: Date.now(),
  };

  return getAuthState();
}
