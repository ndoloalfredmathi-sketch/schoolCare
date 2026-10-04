import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { navigationSections } from "../navigation";

function SideBar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-base-content/10 bg-base-100 px-3 py-4">
      {navigationSections.map(({ label, items }) => (
        <div key={label}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-base-content/40">
            {label}
          </p>

          <ul className="flex flex-col gap-1">
            {items.map(({ to, label: itemLabel, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary font-medium text-primary-content"
                        : "text-base-content/70 hover:bg-base-content/10 hover:text-base-content",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{itemLabel}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

export default SideBar;
