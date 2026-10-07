import type { LucideIcon } from "lucide-react";

type AppHeaderProps = {
  title: string;
  icon: LucideIcon;
  subTitle?: string;
};

/**
 * En-tête de page : titre, icône et fil d'Ariane.
 *
 * Les actions décoratives (recherche, notifications, export) et les onglets de
 * période ont été retirés : ils n'avaient aucun gestionnaire et laissaient croire
 * à des fonctions inexistantes. L'export réel est porté par la barre d'outils de
 * chaque page.
 */
function AppHeader({ title, icon: Icon, subTitle }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-base-content/10 bg-base-100 px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-5 w-5 shrink-0 text-base-content" strokeWidth={1.5} />

        {subTitle ? (
          <>
            <span className="truncate text-base font-medium text-base-content/70">
              {title}
            </span>
            <span className="shrink-0 text-base text-base-content/40">/</span>
            <span className="truncate text-base font-semibold text-base-content">
              {subTitle}
            </span>
          </>
        ) : (
          <span className="truncate text-base font-semibold text-base-content">
            {title}
          </span>
        )}
      </div>
    </header>
  );
}

export default AppHeader;
