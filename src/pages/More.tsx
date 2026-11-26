import { Link } from "react-router-dom";
import { Chevron, Icon } from "../components/ui";

export const MORE_LINKS = [
  { to: "/aircraft", label: "Aircraft", desc: "POHs, checklists, V-speeds and squawks", icon: Icon.plane },
  { to: "/resources", label: "Resources", desc: "Your recommended videos and links by rating", icon: Icon.resources },
  { to: "/me", label: "My training", desc: "What a student sees when they sign in", icon: Icon.roster },
  { to: "/settings", label: "Settings", desc: "Sign-in, sync, backup and import", icon: Icon.settings },
];

const STUDENT_LINKS = [
  { to: "/weather", label: "Weather", desc: "METARs and TAFs for your airports", icon: Icon.weather },
  { to: "/resources", label: "Resources", desc: "Videos and links your instructor recommends", icon: Icon.resources },
  { to: "/settings", label: "Settings", desc: "Sign-in and app color", icon: Icon.settings },
];

export default function More({ student, fleet }: { student?: boolean; fleet?: boolean }) {
  const links = student ? [...(fleet ? [{ to: "/aircraft", label: "Aircraft", desc: "POHs, checklists and V-speeds", icon: Icon.plane }] : []), ...STUDENT_LINKS] : MORE_LINKS;
  return (
    <div className="page">
      <h1>More</h1>
      <section className="rows">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="irow">
            <span className="moreic"><l.icon /></span>
            <span className="ibody">
              <span className="itext"><span className="t1">{l.label}</span><span className="t2">{l.desc}</span></span>
              <Chevron />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
