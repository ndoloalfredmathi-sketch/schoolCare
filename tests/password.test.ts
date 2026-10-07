import { assert, assertEquals, test } from "./harness.ts";
import { hashPassword, verifyPassword } from "../electron/auth/password.js";

export function registerPasswordTests(): void {
  test("un mot de passe est stocké sous forme dérivée, jamais en clair", () => {
    const secret = "MotDePasse!2026";
    const stored = hashPassword(secret);

    assert(!stored.includes(secret), "le mot de passe ne doit pas apparaître");
    assert(
      /^pbkdf2\$210000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(stored),
      `format inattendu : ${stored.slice(0, 40)}…`,
    );
  });

  test("le bon mot de passe est accepté", () => {
    const stored = hashPassword("MotDePasse!2026");

    assert(verifyPassword("MotDePasse!2026", stored), "doit être accepté");
  });

  test("un mot de passe différent est refusé", () => {
    const stored = hashPassword("MotDePasse!2026");

    assert(!verifyPassword("motdepasse!2026", stored), "la casse doit compter");
    assert(!verifyPassword("MotDePasse!202", stored), "un caractère manquant");
    assert(!verifyPassword("", stored), "une chaîne vide");
  });

  test("deux hachages du même mot de passe diffèrent (sel aléatoire)", () => {
    const first = hashPassword("identique");
    const second = hashPassword("identique");

    assert(first !== second, "les sels doivent être distincts");
    assert(verifyPassword("identique", first), "le premier reste valide");
    assert(verifyPassword("identique", second), "le second reste valide");
  });

  test("les accents et caractères Unicode sont gérés", () => {
    const secret = "Élève-Éàçù-2026-🔐";
    const stored = hashPassword(secret);

    assert(verifyPassword(secret, stored), "le mot de passe Unicode doit être accepté");
    assert(!verifyPassword("Eleve-Eacu-2026-🔐", stored), "sans accents doit échouer");
  });

  test("un hachage corrompu est refusé sans lever d'exception", () => {
    const corrupted = [
      "",
      "n'importe quoi",
      "pbkdf2$210000$sel$cle$extra",
      "pbkdf2$abc$c2Vs$Y2xl",
      "pbkdf2$0$c2Vs$Y2xl",
      "pbkdf2$210000$!!!!$!!!!",
      "bcrypt$210000$c2Vs$Y2xl",
    ];

    for (const value of corrupted) {
      let result: boolean;

      try {
        result = verifyPassword("test", value);
      } catch (cause) {
        throw new Error(
          `verifyPassword a levé une exception sur "${value}"`,
          { cause },
        );
      }

      assert(!result, `"${value}" doit être refusé`);
    }
  });

  test("un hachage de longueur inattendue est refusé", () => {
    // Clé tronquée : la comparaison à temps constant exigerait la bonne taille.
    const stored = hashPassword("secret").split("$");
    stored[3] = Buffer.from("trop court").toString("base64");

    assertEquals(
      verifyPassword("secret", stored.join("$")),
      false,
      "une clé tronquée doit être refusée",
    );
  });
}
