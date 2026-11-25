import { Link } from "react-router-dom";
import { Icon } from "../components/ui";

export const MORE_LINKS = [
  { to: "/aircraft", label: "Aircraft", desc: "POHs, checklists, V-speeds and squawks", icon: Icon.plane },
  { to: "/resources", label: "Resources", desc: "Your recommended videos and links by rating", icon: Icon.resources },
  { to: "/me", label: "My training", desc: "What a student sees when they sign in", icon: Icon.roster },
  { to: "/settings", label: "Settings", desc: "Sign-in, sync, backup and import", icon: Icon.settings },
];

export default function More() {
  return (
    <div className="page">
      <h1>More</h1>
      <section className="list">
        {MORE_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="lrow morerow">
            <span className="moreic"><l.icon /></span>
            <span><span className="name">{l.label}</span><span className="sub" style={{ display: "block" }}>{l.desc}</span></span>
          </Link>
        ))}
      </section>
    </div>
  );
}
