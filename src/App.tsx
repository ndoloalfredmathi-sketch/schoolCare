import { Navigate, Route, Routes } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import SideBar from "./components/SideBar";
import PlaceholderPage from "./pages/PlaceholderPage";
import { navigation } from "./navigation";

function App() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <SideBar />

        <main className="min-w-0 flex-1 overflow-auto">
          <Routes>
            {navigation.map(({ to, label }) => (
              <Route
                key={to}
                path={to}
                element={<PlaceholderPage title={label} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
