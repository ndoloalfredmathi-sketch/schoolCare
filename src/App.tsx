import { Outlet } from "react-router-dom";
import clsx from "clsx";
import TitleBar from "./components/TitleBar";

function App() {

  return (
    <div
      className={clsx(
        "flex h-screen w-screen flex-col overflow-hidden bg-slate-600"
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
