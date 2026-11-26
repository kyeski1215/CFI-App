// "Preview as student": shows a student's side of the app (Next, Review, Study, Progress) built on your
// device from their record, with their real activity, read-only.
import { useMemo } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { useToast } from "../../components/ui";
import { useStudentActivity } from "../../lib/activity";
import { buildCard } from "../../lib/card";
import { PreviewCtx, type Preview } from "../../lib/preview";
import { useProfile } from "../../lib/profile";
import { useCollection, useRecord } from "../../lib/store";
import { useSync } from "../../lib/sync";
import type { Resource, Ride, Student } from "../../lib/types";
import Next from "./Next";
import Progress from "./Progress";
import Review from "./Review";
import Study from "./Study";

export default function StudentPreview() {
  const { id = "", tab = "next" } = useParams();
  const s = useRecord<Student>("students", id);
  const rides = useCollection<Ride>("rides");
  const library = useCollection<Resource>("resources");
  const profile = useProfile();
  const sync = useSync();
  const { row } = useStudentActivity(id);
  const toast = useToast();
  const card = useMemo(() => {
    if (!s) return null;
    const instructor = profile?.displayName?.trim() || sync.session?.user.email || undefined;
    const c = buildCard(s, rides, instructor, library, true);
    if (!c) return null;
    const school = profile?.schoolName?.trim() || profile?.logo ? { name: profile?.schoolName?.trim() || undefined, logo: profile?.logo } : undefined;
    return school ? { ...c, school } : c;
  }, [s, rides, library, profile, sync.session]);
  if (!s || !card) return <div className="page"><div className="empty">Student not found. <Link to="/students">Back to roster</Link></div></div>;

  const base = `/preview/${id}`;
  const pv: Preview = { card, act: row?.data ?? {}, base, blocked: () => toast("Preview only. Nothing was changed.") };
  const first = s.name.split(" ")[0] || "student";
  const tabs = [["", "Next"], ["/review", "Review"], ["/study", "Study"], ["/progress", "Progress"]] as const;
  return (
    <PreviewCtx.Provider value={pv}>
      <div className="previewbar" role="status">
        <span>Previewing as <b>{s.name}</b>{!s.shareWithStudent ? " · student access is off" : ""}</span>
        <Link className="btn sm" to={`/students/${id}`}>Done</Link>
      </div>
      <div className="page">
        <nav className="chips kindtabs" aria-label={`${first}'s tabs`}>
          {tabs.map(([p, label]) => (
            <NavLink key={label} to={base + p} end={p === ""} className={({ isActive }) => "chip" + (isActive ? " on" : "")}>{label}</NavLink>
          ))}
        </nav>
        {tab === "review" ? <Review /> : tab === "study" ? <Study /> : tab === "progress" ? <Progress /> : <Next />}
      </div>
    </PreviewCtx.Provider>
  );
}
