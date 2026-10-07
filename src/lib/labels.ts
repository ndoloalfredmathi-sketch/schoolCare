import type { Gender, StudentStatus } from "../types/models";

export const statusClass: Record<StudentStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-base-content/10 text-base-content/50",
};

export const statusLabels: Record<StudentStatus, string> = {
  active: "Actifs",
  inactive: "Sortis",
};

export const genderLabels: Record<Gender, string> = {
  F: "Féminin",
  M: "Masculin",
};

export const statusLabel = (status: StudentStatus): string =>
  status === "active" ? "Actif" : "Sorti";

export const genderLabel = (gender: Gender): string => genderLabels[gender];

/**
 * Les erreurs du processus principal traversent l'IPC encapsulées :
 * "Error: Error invoking remote method 'students:list': Error: <message>".
 * On ne conserve que le dernier message métier pour ne pas exposer de détails
 * techniques à l'utilisateur.
 */
export function errorMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const marker = raw.lastIndexOf("Error: ");

  return marker >= 0 ? raw.slice(marker + "Error: ".length) : raw;
}

export const initialsOf = (student: {
  lastName: string;
  firstName: string;
}): string =>
  `${student.lastName.charAt(0)}${student.firstName.charAt(0)}`.toUpperCase();
