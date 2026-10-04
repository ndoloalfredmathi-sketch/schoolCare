import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import AppHeader from "./components/AppHeader";
import SideBar from "./components/SideBar";
import HomePage from "./pages/HomePage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { navigation, periodTabs } from "./navigation";

function App() {
  const { pathname } = useLocation();

  const current = navigation.find((item) => item.to === pathname);
  const title = current?.label ?? "Accueil";
  const Icon = current?.icon ?? navigation[0].icon;
  const tabs = pathname === "/" ? periodTabs : undefined;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-base-100">
      <TitleBar />
      <AppHeader title={title} icon={Icon} tabs={tabs} />

      <div className="flex min-h-0 flex-1">
        <SideBar />

        <main className="min-w-0 flex-1 overflow-auto">
          <Routes>
            {navigation.map(({ to, label }) => (
              <Route
                key={to}
                path={to}
                element={
                  to === "/" ? (
                    <HomePage />
                  ) : (
                    <PlaceholderPage title={label} />
                  )
                }
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
