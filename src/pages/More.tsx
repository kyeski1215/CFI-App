import { Link } from "react-router-dom";
import { Chevron, Icon } from "../components/ui";

export const MORE_LINKS = [
  { to: "/me", label: "My training", desc: "What a student sees when they sign in", icon: Icon.roster },
  { to: "/settings", label: "Settings", desc: "Sign-in, sync, backup and import", icon: Icon.settings },
];

const STUDENT_LINKS = [
  { to: "/resources", label: "Resources", desc: "Videos, links and aircraft documents", icon: Icon.resources },
  { to: "/settings", label: "Settings", desc: "Sign-in and app color", icon: Icon.settings },
];

export default function More({ student }: { student?: boolean }) {
  const links = student ? STUDENT_LINKS : MORE_LINKS;
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
