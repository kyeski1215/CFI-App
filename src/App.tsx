import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Icon } from "./components/ui";
import { useMyCards, useSharedFleet, useSync } from "./lib/sync";
import { useCollection } from "./lib/store";
import Weather from "./pages/Weather";
import Aircraft from "./pages/Aircraft";
import MyTraining from "./pages/MyTraining";
import More from "./pages/More";
import Roster from "./pages/Roster";
import StudentPage from "./pages/StudentPage";
import Mocks from "./pages/Mocks";
import MockRide from "./pages/MockRide";
import RegLogger from "./pages/RegLogger";
import Resources from "./pages/Resources";
import Settings from "./pages/Settings";

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
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/students" element={<Roster />} />
          <Route path="/students/:id" element={<StudentPage />} />
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
