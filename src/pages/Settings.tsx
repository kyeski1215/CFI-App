import { useRef, useState } from "react";
import { useToast } from "../components/ui";
import { importLegacy } from "../lib/legacy";
import { exportAll, useCollection } from "../lib/store";
import { signIn, signOut, signUp, syncConfigured, syncNow, useSharedLibrary, useSync } from "../lib/sync";
import BlitzAccess from "../components/BlitzAccess";

export default function Settings() {
  const sync = useSync();
  const lib = useSharedLibrary();
  const toast = useToast();
  const students = useCollection("students");
  const rides = useCollection("rides");
  const fileRef = useRef<HTMLInputElement>(null);
  const [legacy, setLegacy] = useState("");

  const download = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cfi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <header className="page-head"><h1>Settings</h1></header>

      <section className="card">
        <h3>Sync across devices</h3>
        {!syncConfigured ? (
          <p className="small muted" style={{ margin: 0 }}>
            Sync isn't set up in this build, so everything is saved on this device only. See <b>README → Turn on cloud sync</b>; once
            the Supabase keys are added, sign in here and your data uploads automatically.
          </p>
        ) : sync.session ? (
          <>
            <div className="row">
              <span className={"sync-dot " + sync.status} />
              <span>Signed in as <b>{sync.session.user.email}</b></span>
            </div>
            <div className="small muted">
              {sync.status === "error" ? "Sync error: " + sync.error : sync.status === "offline" ? "Offline — changes will upload when you reconnect." : sync.lastSync ? "Last synced " + new Date(sync.lastSync).toLocaleTimeString() : "Syncing…"}
            </div>
            <div className="row">
              <button className="btn" onClick={() => syncNow()}>Sync now</button>
              <button className="btn" onClick={() => signOut()}>Sign out</button>
            </div>
          </>
        ) : (
          <SignIn />
        )}
      </section>

      {sync.session && lib.isOwner && <BlitzAccess />}

      <section className="card">
        <h3>Backup</h3>
        <p className="small muted" style={{ margin: 0 }}>{students.length} students · {rides.length} mock checkrides on this device.</p>
        <div className="row">
          <button className="btn" onClick={download}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from file</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const r = importLegacy(JSON.parse(await f.text()));
              toast(`Imported ${r.students} records${r.rides ? `, ${r.rides} mocks` : ""}`);
            } catch {
              toast("That file isn't a CFI backup");
            }
            e.target.value = "";
          }} />
        </div>
      </section>

      <section className="card">
        <h3>Import from the old artifacts</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Paste the JSON export of your Student Roster or Mock Checkride Logger artifact. Students are matched by name so mock checkrides link up.
        </p>
        <textarea value={legacy} onChange={(e) => setLegacy(e.target.value)} placeholder='{"students": [...]} or {"rides": {...}}' style={{ minHeight: 100, fontFamily: "var(--f-mono)", fontSize: 13 }} />
        <div className="row">
          <button className="btn primary" disabled={!legacy.trim()} onClick={() => {
            try {
              const r = importLegacy(JSON.parse(legacy));
              toast(`Imported ${r.students} students, ${r.rides} mocks`);
              setLegacy("");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't read that JSON");
            }
          }}>Import</button>
        </div>
      </section>

      <section className="card">
        <h3>Install on your phone</h3>
        <p className="small" style={{ margin: 0 }}>
          <b>iPhone / iPad:</b> open this page in Safari → Share → <i>Add to Home Screen</i>.<br />
          <b>Android / Chrome:</b> menu → <i>Install app</i>.<br />
          It opens full-screen and works offline in the airplane.
        </p>
      </section>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="fields" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setMsg("");
      try {
        if (mode === "in") await signIn(email, pw);
        else if (!(await signUp(email, pw))) setMsg("Check your email to confirm the account, then sign in.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    }}>
      <label className="f full">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="f full">Password<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {msg && <div className="full small" style={{ color: "var(--warn)" }}>{msg}</div>}
      <div className="row full">
        <button type="button" className="btn ghost sm" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account instead" : "I already have an account"}
        </button>
        <span className="spacer" />
        <button className="btn primary" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
      </div>
      <p className="full small muted" style={{ margin: 0 }}>Anything already on this device uploads when you sign in.</p>
    </form>
  );
}
