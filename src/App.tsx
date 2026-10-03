import { Outlet } from "react-router-dom";
import clsx from "clsx";
import TitleBar from "./components/TitleBar";
import { useIsMaximized } from "./hooks/useIsMaximized";

function App() {
  const isMaximized = useIsMaximized();

  return (
    <div
      className={clsx(
        "flex h-screen w-screen flex-col overflow-hidden bg-slate-600",
        !isMaximized && "rounded-lg"
      )}
    >
      <TitleBar />

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
