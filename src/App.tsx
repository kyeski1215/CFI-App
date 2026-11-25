import { Suspense, lazy } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Icon } from "./components/ui";
import { useMyCards, useSharedFleet, useSync } from "./lib/sync";
import { useCollection } from "./lib/store";
import { applyUpdate, useUpdateAvailable } from "./lib/updates";
import Roster from "./pages/Roster";
import StudentPage from "./pages/StudentPage";

// Less-used pages load on first visit so the app starts faster.
const Weather = lazy(() => import("./pages/Weather"));
const Aircraft = lazy(() => import("./pages/Aircraft"));
const MyTraining = lazy(() => import("./pages/MyTraining"));
const More = lazy(() => import("./pages/More"));
const ImportLogbook = lazy(() => import("./pages/ImportLogbook"));
const ImportCleanup = lazy(() => import("./pages/ImportCleanup"));
const Mocks = lazy(() => import("./pages/Mocks"));
const MockRide = lazy(() => import("./pages/MockRide"));
const RegLogger = lazy(() => import("./pages/RegLogger"));
const Resources = lazy(() => import("./pages/Resources"));
const Settings = lazy(() => import("./pages/Settings"));

// Adding a new module = add a route + an entry in these lists.
const MAIN = [
  { to: "/students", label: "Roster", icon: Icon.roster },
  { to: "/mocks", label: "Mocks", icon: Icon.mock },
  { to: "/regs", label: "Regs", icon: Icon.regs },
  { to: "/weather", label: "Weather", icon: Icon.weather },
];
const SIDE_EXTRA = [
  { to: "/aircraft", label: "Aircraft", icon: Icon.plane },
  { to: "/resources", label: "Resources", icon: Icon.resources },
  { to: "/settings", label: "Settings", icon: Icon.settings },
];
// What a student who signs in (and has no roster of their own) sees.
const STUDENT_NAV = [
  { to: "/me", label: "My training", icon: Icon.roster },
  { to: "/weather", label: "Weather", icon: Icon.weather },
  { to: "/resources", label: "Resources", icon: Icon.resources },
  { to: "/settings", label: "Settings", icon: Icon.settings },
];

export default function App() {
  const sync = useSync();
  const updateReady = useUpdateAvailable();
  const { cards } = useMyCards();
  const students = useCollection("students");
  const studentMode = cards.length > 0 && students.length === 0;
  const fleet = useSharedFleet().items;
  const studentNav = fleet.length ? [STUDENT_NAV[0], { to: "/aircraft", label: "Aircraft", icon: Icon.plane }, ...STUDENT_NAV.slice(1)] : STUDENT_NAV;
  const side = studentMode ? studentNav : [...MAIN, ...(cards.length ? [{ to: "/me", label: "My training", icon: Icon.roster }] : []), ...SIDE_EXTRA];
  const tabs = studentMode ? studentNav : [...MAIN, { to: "/more", label: "More", icon: Icon.more }];
  const home = studentMode ? "/me" : "/students";
  return (
    <div className="app">
      <nav className="sidenav" aria-label="Main">
        <div className="brand">
          <img src="icon.svg" alt="" /> CFI Cockpit
        </div>
        {side.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <n.icon /> {n.label}
          </NavLink>
        ))}
        <div className="foot muted">
          <span className={"sync-dot " + sync.status} />{" "}
          {sync.status === "off" ? "On this device" : sync.session ? `Sync: ${sync.status}` : "Not signed in"}
        </div>
      </nav>
      <main className="main">
        {updateReady && (
          <div className="updatebar" role="status">
            <span>A new version of the app is ready.</span>
            <button className="btn primary sm" onClick={applyUpdate}>Update now</button>
          </div>
        )}
        <Suspense fallback={<div className="page"><div className="muted small">Loading…</div></div>}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/students" element={<Roster />} />
          <Route path="/students/:id" element={<StudentPage />} />
          <Route path="/import" element={<ImportLogbook />} />
          <Route path="/import/fix" element={<ImportCleanup />} />
          <Route path="/mocks" element={<Mocks />} />
          <Route path="/mocks/:id" element={<MockRide />} />
          <Route path="/regs" element={<RegLogger />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/aircraft" element={<Aircraft />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/me" element={<MyTraining />} />
          <Route path="/more" element={<More />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        </Suspense>
      </main>
      <nav className="tabbar" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive || (n.to === "/more" && /^#\/(aircraft|resources|settings|me)/.test(location.hash)) ? "active" : "")}>
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
