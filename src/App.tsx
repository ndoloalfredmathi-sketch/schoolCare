import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import AppHeader from "./components/AppHeader";
import SideBar from "./components/SideBar";
import PlaceholderPage from "./pages/placeholder/PlaceholderPage";
import StudentsListPage from "./pages/students/StudentsListPage";
import StudentInscriptionsPage from "./pages/students/StudentInscriptionsPage";
import {
  navigation,
  periodTabs,
  type NavigationItem,
} from "./navigation";

function pageFor(fullPath: string, title: string) {
  if (fullPath === "/eleves/liste") {
    return <StudentsListPage />;
  }

  if (fullPath === "/eleves/inscriptions") {
    return <StudentInscriptionsPage />;
  }

  return <PlaceholderPage title={title} />;
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

function App() {
  const { pathname } = useLocation();
  const current = findCurrent(pathname);
  const tabs = current.to === "/" ? periodTabs : undefined;
  const subTitle = current.tabs?.find(
    (tab) => pathname === `${current.to}/${tab.to}`,
  )?.label;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-base-100">
      <TitleBar />
      <AppHeader
        title={current.label}
        icon={current.icon}
        subTitle={subTitle}
        tabs={tabs}
      />

      <div className="flex min-h-0 flex-1">
        <SideBar />

        <main className="min-w-0 flex-1 overflow-auto">
          <Routes>
            {navigation.map(({ to, label, tabs: childTabs }) =>
              childTabs ? (
                <Route key={to} path={to} element={<Outlet />}>
                  <Route
                    index
                    element={<Navigate to={childTabs[0].to} replace />}
                  />
                  {childTabs.map((tab) => (
                    <Route
                      key={tab.to}
                      path={tab.to}
                      element={pageFor(`${to}/${tab.to}`, tab.label)}
                    />
                  ))}
                </Route>
              ) : (
                <Route
                  key={to}
                  path={to}
                  element={
                    <PlaceholderPage title={label} />
                  }
                />
              ),
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
