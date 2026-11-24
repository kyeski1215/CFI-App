import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Icon } from "./components/ui";
import { useSync } from "./lib/sync";
import Roster from "./pages/Roster";
import StudentPage from "./pages/StudentPage";
import Mocks from "./pages/Mocks";
import MockRide from "./pages/MockRide";
import RegLogger from "./pages/RegLogger";
import Resources from "./pages/Resources";
import Settings from "./pages/Settings";

// Adding a new module = add a route + a NAV entry.
const NAV = [
  { to: "/students", label: "Roster", icon: Icon.roster },
  { to: "/mocks", label: "Mocks", icon: Icon.mock },
  { to: "/regs", label: "Regs", icon: Icon.regs },
  { to: "/resources", label: "Resources", icon: Icon.resources },
  { to: "/settings", label: "Settings", icon: Icon.settings },
];

export default function App() {
  const sync = useSync();
  return (
    <div className="app">
      <nav className="sidenav" aria-label="Main">
        <div className="brand">
          <img src="icon.svg" alt="" /> CFI Cockpit
        </div>
        {NAV.map((n) => (
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
          <Route path="/" element={<Navigate to="/students" replace />} />
          <Route path="/students" element={<Roster />} />
          <Route path="/students/:id" element={<StudentPage />} />
          <Route path="/mocks" element={<Mocks />} />
          <Route path="/mocks/:id" element={<MockRide />} />
          <Route path="/regs" element={<RegLogger />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
