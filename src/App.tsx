import { Suspense, lazy } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Icon } from "./components/ui";
import { useMyCards, useSync } from "./lib/sync";
import { useCollection } from "./lib/store";
import { applyUpdate, useUpdateAvailable } from "./lib/updates";
import Roster from "./pages/Roster";
import StudentPage from "./pages/StudentPage";

// Less-used pages load on first visit so the app starts faster.
const MyTraining = lazy(() => import("./pages/MyTraining"));
const StudentNext = lazy(() => import("./pages/student/Next"));
const StudentReview = lazy(() => import("./pages/student/Review"));
const StudentStudy = lazy(() => import("./pages/student/Study"));
const StudentProgress = lazy(() => import("./pages/student/Progress"));
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
  { to: "/resources", label: "Resources", icon: Icon.resources },
];
const SIDE_EXTRA = [
  { to: "/settings", label: "Settings", icon: Icon.settings },
];
// What a student who signs in (and has no roster of their own) sees.
const STUDENT_NAV = [
  { to: "/me", label: "Next", icon: Icon.next },
  { to: "/me/review", label: "Review", icon: Icon.chat },
  { to: "/me/study", label: "Study", icon: Icon.cards },
  { to: "/me/progress", label: "Progress", icon: Icon.chart },
];
const STUDENT_MORE = [
  { to: "/resources", label: "Resources", icon: Icon.resources },
  { to: "/settings", label: "Settings", icon: Icon.settings },
];

export default function App() {
  const loc = useLocation();
  const sync = useSync();
  const updateReady = useUpdateAvailable();
  const { cards } = useMyCards();
  const students = useCollection("students");
  const studentMode = cards.length > 0 && students.length === 0;
  const studentMore = STUDENT_MORE;
  const side = studentMode ? [...STUDENT_NAV, ...studentMore] : [...MAIN, ...(cards.length ? [{ to: "/me", label: "My training", icon: Icon.roster }] : []), ...SIDE_EXTRA];
  const tabs = studentMode ? [...STUDENT_NAV, { to: "/more", label: "More", icon: Icon.more }] : [...MAIN, { to: "/more", label: "More", icon: Icon.more }];
  const home = studentMode ? "/me" : "/students";
  return (
    <div className="app">
      <nav className="sidenav" aria-label="Main">
        <div className="brand">
          <img src="icon.svg" alt="" /> Dual Given
        </div>
        {side.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/me"}>
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
        <div key={loc.pathname} className="routefade">
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/students" element={<Roster />} />
          <Route path="/students/:id" element={<StudentPage />} />
          <Route path="/import" element={<ImportLogbook />} />
          <Route path="/import/fix" element={<ImportCleanup />} />
          <Route path="/mocks" element={<Mocks />} />
          <Route path="/mocks/:id" element={<MockRide />} />
          <Route path="/regs" element={<RegLogger />} />
          <Route path="/aircraft" element={<Navigate to="/resources?tab=aircraft" replace />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/me" element={studentMode ? <StudentNext /> : <MyTraining />} />
          <Route path="/me/review" element={<StudentReview />} />
          <Route path="/me/study" element={<StudentStudy />} />
          <Route path="/me/study/:deck" element={<StudentStudy />} />
          <Route path="/me/progress" element={<StudentProgress />} />
          <Route path="/more" element={<More student={studentMode} />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        </div>
        </Suspense>
      </main>
      <nav className="tabbar" aria-label="Main" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/me"} className={({ isActive }) => (isActive || (n.to === "/more" && (studentMode ? /^#\/(resources|settings)/ : /^#\/(settings|me)/).test(location.hash)) ? "active" : "")}>
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
