import clsx from "clsx";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Download, Search } from "lucide-react";

type AppHeaderProps = {
  title: string;
  icon: LucideIcon;
  subTitle?: string;
  tabs?: string[];
};

const iconButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-full bg-base-300 text-base-content/70 transition-colors hover:text-base-content";

function AppHeader({ title, icon: Icon, subTitle, tabs }: AppHeaderProps) {
  const [selectedTab, setSelectedTab] = useState<string>();
  const activeTab =
    tabs && selectedTab && tabs.includes(selectedTab)
      ? selectedTab
      : tabs?.[0];

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

      {tabs && tabs.length > 0 ? (
        <nav className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-1 rounded-full bg-base-300 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={tab === activeTab}
                onClick={() => setSelectedTab(tab)}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  tab === activeTab
                    ? "bg-primary font-medium text-primary-content"
                    : "text-base-content/60 hover:text-base-content",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Rechercher"
          className={iconButtonClass}
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className={clsx(iconButtonClass, "relative")}
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error" />
        </button>

        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-content transition-opacity hover:opacity-90"
        >
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Exporter
        </button>
      </div>
    </header>
  );
}

export default AppHeader;
