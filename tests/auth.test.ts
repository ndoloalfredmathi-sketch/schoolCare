import { mock } from "node:test";
import {
  assert,
  assertEquals,
  assertThrows,
  test,
} from "./harness.ts";
import { resetDataDirectory } from "./helpers.ts";
import { closeDatabase, getDatabase } from "../electron/db/index.js";
import {
  changePassword,
  currentActor,
  getAuthState,
  getPendingUser,
  listAccounts,
  login,
  logout,
  requireAuthenticated,
} from "../electron/auth/session.js";

const INITIAL_PASSWORD = "SchoolCare2026!";
const NEW_PASSWORD = "NouveauMotDePasse2026!";

/** Ouvre une base neuve et laisse l'état d'authentification propre. */
function withFreshAuth(run: () => void): void {
  resetDataDirectory("auth");
  getDatabase();
  logout();

  try {
    run();
  } finally {
    logout();
    closeDatabase();
    mock.timers.reset();
  }
}

export function registerAuthTests(): void {
  test("la session est fermée au démarrage", () => {
    withFreshAuth(() => {
      assertEquals(getAuthState().authenticated, false, "aucune session");
      assertEquals(getAuthState().user, null, "aucun utilisateur");
      assertEquals(currentActor(), "anonyme", "acteur par défaut");
      assertEquals(getPendingUser(), null, "aucun changement de mot de passe en attente");
    });
  });

  test("les comptes actifs sont proposés à la connexion", () => {
    withFreshAuth(() => {
      const accounts = listAccounts();

      assertEquals(accounts.length, 1, "un seul compte livré");
      assertEquals(accounts[0].displayName, "Administrateur", "nom affiché");
      assertEquals(accounts[0].role, "admin", "rôle");

      // Un compte désactivé ne doit pas apparaître.
      getDatabase()
        .prepare("INSERT INTO users (role_id, display_name, is_active) VALUES (2, 'Inactif', 0)")
        .run();

      assertEquals(listAccounts().length, 1, "les comptes inactifs sont masqués");
    });
  });

  test("un mot de passe incorrect est refusé et la session reste fermée", () => {
    withFreshAuth(() => {
      assertThrows(
        () => login(1, "mauvais"),
        "incorrect",
        "un mauvais mot de passe doit être refusé",
      );
      assertEquals(getAuthState().authenticated, false, "toujours déconnecté");
    });
  });

  test("un compte inexistant ou désactivé est refusé", () => {
    withFreshAuth(() => {
      assertThrows(
        () => login(9999, INITIAL_PASSWORD),
        "inconnu ou désactivé",
        "un identifiant inexistant",
      );

      const database = getDatabase();
      database
        .prepare(
          `INSERT INTO users (id, role_id, display_name, is_active, password_hash)
           VALUES (50, 2, 'Désactivé', 0, 'pbkdf2$1$x$y')`,
        )
        .run();

      assertThrows(
        () => login(50, "peu importe"),
        "inconnu ou désactivé",
        "un compte désactivé",
      );
    });
  });

  test("une première connexion impose le changement de mot de passe", () => {
    withFreshAuth(() => {
      const state = login(1, INITIAL_PASSWORD);

      assertEquals(state.authenticated, true, "connecté");
      assertEquals(state.user?.mustChangePassword, true, "changement imposé");
      assertEquals(getPendingUser()?.id, 1, "utilisateur en attente");
      assertEquals(currentActor(), "admin@schoolcare.local", "acteur = identifiant");

      const row = getDatabase()
        .prepare("SELECT last_login_at FROM users WHERE id = 1")
        .get() as { last_login_at: string | null };

      assert(row.last_login_at !== null, "la date de connexion doit être enregistrée");
    });
  });

  test("le nouveau mot de passe doit être valide et différent", () => {
    withFreshAuth(() => {
      login(1, INITIAL_PASSWORD);

      assertThrows(
        () => changePassword(INITIAL_PASSWORD, "court"),
        "8 caractères",
        "un mot de passe trop court",
      );
      assertThrows(
        () => changePassword(INITIAL_PASSWORD, INITIAL_PASSWORD),
        "différent",
        "un mot de passe identique",
      );
      assertThrows(
        () => changePassword("pas le bon", NEW_PASSWORD),
        "incorrect",
        "un mot de passe actuel erroné",
      );
    });
  });

  test("changer le mot de passe invalide l'ancien", () => {
    withFreshAuth(() => {
      login(1, INITIAL_PASSWORD);

      const state = changePassword(INITIAL_PASSWORD, NEW_PASSWORD);
      assertEquals(state.user?.mustChangePassword, false, "changement levé");

      // Le nouveau mot de passe est bien celui qui est stocké.
      const stored = getDatabase()
        .prepare("SELECT password_hash, must_change_password FROM users WHERE id = 1")
        .get() as { password_hash: string; must_change_password: number };

      assertEquals(stored.must_change_password, 0, "indicateur remis à zéro");
      assert(
        !stored.password_hash.includes(NEW_PASSWORD),
        "le mot de passe ne doit pas être stocké en clair",
      );

      logout();
      assertThrows(
        () => login(1, INITIAL_PASSWORD),
        "incorrect",
        "l'ancien mot de passe doit être refusé",
      );
      assertEquals(
        login(1, NEW_PASSWORD).authenticated,
        true,
        "le nouveau mot de passe doit fonctionner",
      );
    });
  });

  test("cinq échecs verrouillent temporairement le compte", () => {
    withFreshAuth(() => {
      mock.timers.enable({ apis: ["Date"] });

      try {
        for (let attempt = 1; attempt <= 4; attempt += 1) {
          assertThrows(
            () => login(1, "mauvais"),
            `(${attempt}/5)`,
            `échec ${attempt}`,
          );
        }

        assertThrows(
          () => login(1, "mauvais"),
          "verrouillé 30 secondes",
          "le cinquième échec verrouille",
        );

        // Même avec le bon mot de passe, le compte reste verrouillé.
        assertThrows(
          () => login(1, INITIAL_PASSWORD),
          "Trop de tentatives",
          "verrouillage actif",
        );

        mock.timers.tick(31_000);

        assertEquals(
          login(1, INITIAL_PASSWORD).authenticated,
          true,
          "après le délai, la connexion doit être possible",
        );
        assertEquals(
          getAuthState().user?.mustChangePassword,
          true,
          "l'état du compte est inchangé",
        );
      } finally {
        mock.timers.reset();
      }
    });
  });

  test("une connexion réussie remet le compteur d'échecs à zéro", () => {
    withFreshAuth(() => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        assertThrows(() => login(1, "mauvais"), `(${attempt}/5)`, `échec ${attempt}`);
      }

      login(1, INITIAL_PASSWORD);
      logout();

      // Après une réussite, le compteur repart de zéro : le prochain échec
      // doit de nouveau être annoncé comme le premier.
      assertThrows(
        () => login(1, "mauvais"),
        "(1/5)",
        "le compteur doit être réinitialisé",
      );
    });
  });

  test("la session se verrouille après 30 minutes d'inactivité", () => {
    withFreshAuth(() => {
      mock.timers.enable({ apis: ["Date"] });

      try {
        login(1, INITIAL_PASSWORD);
        changePassword(INITIAL_PASSWORD, NEW_PASSWORD);

        mock.timers.tick(29 * 60 * 1000);
        assertEquals(getAuthState().authenticated, true, "toujours actif à 29 min");

        mock.timers.tick(2 * 60 * 1000);
        assertEquals(
          getAuthState().authenticated,
          false,
          "verrouillé après 30 minutes",
        );
        assertEquals(getAuthState().user, null, "plus d'utilisateur");
        assertEquals(currentActor(), "anonyme", "acteur redevenu anonyme");
      } finally {
        mock.timers.reset();
      }
    });
  });

  test("la déconnexion ferme immédiatement la session", () => {
    withFreshAuth(() => {
      login(1, INITIAL_PASSWORD);
      changePassword(INITIAL_PASSWORD, NEW_PASSWORD);
      assertEquals(getAuthState().authenticated, true, "connecté");

      const state = logout();

      assertEquals(state.authenticated, false, "déconnecté");
      assertEquals(state.user, null, "aucun utilisateur");
      assertEquals(getPendingUser(), null, "aucun changement en attente");
      assertEquals(currentActor(), "anonyme", "acteur anonyme");
    });
  });

  test("un changement de mot de passe en attente bloque l'accès aux données", () => {
    withFreshAuth(() => {
      login(1, INITIAL_PASSWORD);

      // `requireAuthenticated` est le garde-fou utilisé par tous les handlers IPC.
      assertThrows(
        () => requireAuthenticated(),
        "nouveau mot de passe",
        "l'accès doit être refusé avant le changement",
      );
    });
  });
}
