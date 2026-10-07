import clsx from "clsx";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { navigationSections } from "../navigation";
import type { AuthUser, RoleKey } from "../types/models";

const roleLabels: Record<RoleKey, string> = {
  admin: "Administrateur",
  teacher: "Enseignant",
  parent: "Parent",
  student: "Élève",
};

const itemClass = (isActive: boolean) =>
  clsx(
    "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-primary font-medium text-primary-content"
      : "text-base-content/70 hover:bg-base-content/10 hover:text-base-content",
  );

const groupClass = (isActive: boolean) =>
  clsx(
    "flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition-colors",
    isActive
      ? "bg-base-content/10 font-medium text-base-content"
      : "text-base-content/70 hover:bg-base-content/10 hover:text-base-content",
  );

const subItemClass = (isActive: boolean) =>
  clsx(
    "block rounded-full px-3 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-primary font-medium text-primary-content"
      : "text-base-content/60 hover:bg-base-content/10 hover:text-base-content",
  );

function SideBar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-base-content/10 bg-base-100 px-3 py-4">
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {navigationSections.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-base-content/40">
              {label}
            </p>

            <ul className="flex flex-col gap-1">
              {items.map(({ to, label: itemLabel, icon: Icon, children }) => {
                if (!children) {
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={to === "/"}
                        className={({ isActive }) => itemClass(isActive)}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <span>{itemLabel}</span>
                      </NavLink>
                    </li>
                  );
                }

                const isInside =
                  pathname === to || pathname.startsWith(`${to}/`);
                const isOpen = openGroups[to] ?? isInside;

                const handleToggle = () => {
                  setOpenGroups((prev) => ({ ...prev, [to]: !isOpen }));
                };

                return (
                  <li key={to}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={handleToggle}
                      className={groupClass(isInside)}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="flex-1">{itemLabel}</span>
                      <ChevronDown
                        className={clsx(
                          "h-4 w-4 shrink-0 transition-transform",
                          isOpen ? "rotate-180" : "rotate-0",
                        )}
                        strokeWidth={1.5}
                      />
                    </button>

                    {isOpen ? (
                      <ul className="ml-5 mt-1 flex flex-col gap-1 border-l border-base-content/10 pl-5">
                        {children.map((child) => (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              className={({ isActive }) =>
                                subItemClass(isActive)
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-base-content/10 pt-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-base-content/5 px-2.5 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {user.displayName.charAt(0).toUpperCase()}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-base-content">
              {user.displayName}
            </span>
            <span className="block truncate text-[11px] text-base-content/45">
              {roleLabels[user.role]}
            </span>
          </span>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="shrink-0 rounded-full p-1.5 text-base-content/40 transition hover:bg-base-content/10 hover:text-base-content"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default SideBar;
