import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import AppHeader from "./components/AppHeader";
import SideBar from "./components/SideBar";
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/settings/SettingsPage";
import { LoginScreen } from "./pages/auth/LoginScreen";
import { ChangePasswordScreen } from "./pages/auth/ChangePasswordScreen";
import StudentsListPage from "./pages/students/StudentsListPage";
import StudentInscriptionsPage from "./pages/students/StudentInscriptionsPage";
import StudentDossiersPage from "./pages/students/StudentDossiersPage";
import StudentDossierPage from "./pages/students/StudentDossierPage";
import { getAuthState, logout } from "./services/api";
import { navigation, type NavigationItem } from "./navigation";
import type { AuthState, AuthUser } from "./types/models";

/**
 * Pages réellement implémentées. Toute route absente de cette table affiche un
 * écran « en cours de développement » plutôt qu'une page vide.
 */
const pages: Record<string, () => React.ReactElement> = {
  "/eleves/liste": StudentsListPage,
  "/eleves/inscriptions": StudentInscriptionsPage,
  "/eleves/dossiers": StudentDossiersPage,
  "/parametres": SettingsPage,
};

function renderPage(path: string, title: string) {
  const Page = pages[path];

  return Page ? <Page /> : <PlaceholderPage title={title} />;
}

function findCurrent(pathname: string): NavigationItem {
  const match = [...navigation]
    .reverse()
    .find((item) =>
      item.to === "/"
        ? pathname === "/"
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    );

  return match ?? navigation[0];
}

/** Fils d'Ariane : onglet courant, ou fiche détaillée ("Dossiers / Fiche élève"). */
function findSubTitle(
  item: NavigationItem,
  pathname: string,
): string | undefined {
  const exact = item.children?.find((child) => child.to === pathname);

  if (exact) {
    return exact.label;
  }

  if (item.to === "/eleves" && pathname.startsWith("/eleves/dossiers/")) {
    return "Fiche élève";
  }

  return undefined;
}

/** Routes de l'application (utilisées deux fois : une par niveau de layout). */
function AppRoutes() {
  return (
    <Routes>
      {navigation.map(({ to, label, children }) => {
        if (!children) {
          return <Route key={to} path={to} element={renderPage(to, label)} />;
        }

        return (
          <Route key={to} path={to} element={<Outlet />}>
            <Route index element={<Navigate to={children[0].to} replace />} />
            {children.map((child) => (
              /* Segment relatif au parent : "/eleves" + "liste" */
              <Route
                key={child.to}
                path={child.to.slice(to.length + 1)}
                element={renderPage(child.to, child.label)}
              />
            ))}
            {to === "/eleves" ? (
              <Route path="dossiers/:id" element={<StudentDossierPage />} />
            ) : null}
          </Route>
        );
      })}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Barre de titre + barre latérale + en-tête de page + contenu routé. */
function AppShell({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const current = findCurrent(pathname);
  const subTitle = findSubTitle(current, pathname);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-base-100">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <SideBar user={user} onLogout={onLogout} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            title={current.label}
            icon={current.icon}
            subTitle={subTitle}
          />

          <main className="min-w-0 flex-1 overflow-auto">
            <AppRoutes />
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Racine de l'application : rien n'est affiché tant que la session n'est pas
 * ouverte. Le processus principal refuse de toute façon toute opération sur les
 * données sans session valide — cet écran est l'affichage, pas la sécurité.
 */
function Root() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAuthState()
      .then((state) => {
        if (!cancelled) {
          setAuth(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuth({ authenticated: false, user: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(() => {
    void logout().then(setAuth);
  }, []);

  if (auth === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-base-100 text-sm text-base-content/50">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  if (!auth.authenticated || !auth.user) {
    return <LoginScreen onAuthenticated={setAuth} />;
  }

  if (auth.user.mustChangePassword) {
    return <ChangePasswordScreen user={auth.user} onChanged={setAuth} />;
  }

  return <AppShell user={auth.user} onLogout={handleLogout} />;
}

export default Root;
