import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Dérivation de mot de passe PBKDF2-SHA512. Aucune dépendance externe.
 *
 * Format stocké : "pbkdf2$<itérations>$<sel base64>$<clé base64>"
 */
const ALGORITHM = "pbkdf2";
const ITERATIONS = 210_000;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);

  return derive(password, salt, ITERATIONS);
}

function derive(password: string, salt: Buffer, iterations: number): string {
  const key = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, "sha512");

  return [
    ALGORITHM,
    iterations,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** Comparaison à temps constant : jamais un `===` sur un secret. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");

  if (parts.length !== 4 || parts[0] !== ALGORITHM) {
    return false;
  }

  const iterations = Number.parseInt(parts[1], 10);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;

  try {
    salt = Buffer.from(parts[2], "base64");
    expected = Buffer.from(parts[3], "base64");
  } catch {
    return false;
  }

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, iterations, expected.length, "sha512");

  return timingSafeEqual(candidate, expected);
}
