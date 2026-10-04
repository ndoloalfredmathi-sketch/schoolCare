import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { navigation } from "../navigation";

function SideBar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel text-sm text-slate-300">
      <nav className="flex-1 overflow-y-auto p-2">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                isActive
                  ? "bg-accent/20 font-medium text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default SideBar;
