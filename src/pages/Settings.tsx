import { useRef, useState } from "react";
import { useToast } from "../components/ui";
import { importLegacy } from "../lib/legacy";
import { exportAll, restoreSnapshot, snapshot, useCollection, useSnapshots } from "../lib/store";
import { signIn, signOut, signUp, syncConfigured, syncNow, useSharedLibrary, useSync } from "../lib/sync";
import BlitzAccess from "../components/BlitzAccess";
import { ACCENTS, setAccent, setTheme, useAccent, useTheme, type ThemeMode } from "../lib/theme";
import { checkForUpdate, forceRefresh } from "../lib/updates";
import { logoFromFile, saveProfile, useProfile } from "../lib/profile";

export default function Settings() {
  const sync = useSync();
  const lib = useSharedLibrary();
  const toast = useToast();
  const students = useCollection("students");
  const rides = useCollection("rides");
  const fileRef = useRef<HTMLInputElement>(null);
  const [legacy, setLegacy] = useState("");
  const accent = useAccent();
  const theme = useTheme();
  const profile = useProfile();
  const logoRef = useRef<HTMLInputElement>(null);

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
        <h3>You & your school</h3>
        <div className="small muted">Students see your name instead of your email, and your school's name and logo on their side.</div>
        <div className="fields">
          <label className="f">Your name<input value={profile?.displayName ?? ""} placeholder="e.g. Alex Morgan" onChange={(e) => saveProfile({ displayName: e.target.value })} /></label>
          <label className="f">School<input value={profile?.schoolName ?? ""} placeholder="e.g. your flight school" onChange={(e) => saveProfile({ schoolName: e.target.value })} /></label>
        </div>
        <div className="row">
          {profile?.logo ? <img src={profile.logo} alt="School logo" className="logoprev" /> : <span className="logoprev empty" aria-hidden="true">Logo</span>}
          <button className="btn sm" onClick={() => logoRef.current?.click()}>{profile?.logo ? "Change logo" : "Add logo"}</button>
          {profile?.logo && <button className="btn sm danger" onClick={() => saveProfile({ logo: undefined })}>Remove</button>}
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try { saveProfile({ logo: await logoFromFile(f) }); toast("Logo saved"); } catch (err) { toast(err instanceof Error ? err.message : "Couldn't read that image"); }
          }} />
        </div>
      </section>

      <section className="card">
        <h3>Appearance</h3>
        <div className="chips kindtabs" role="radiogroup" aria-label="Light or dark mode">
          {([["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"]] as [ThemeMode, string][]).map(([m, label]) => (
            <button key={m} type="button" role="radio" className="chip" aria-checked={theme === m} aria-pressed={theme === m} onClick={() => setTheme(m)}>{label}</button>
          ))}
        </div>
        <div className="small muted">Automatic follows your phone's light or dark setting.</div>
      </section>

      <section className="card">
        <h3>App color</h3>
        <div className="small muted">Buttons, tabs and highlights use this one color. Pick your school's color.</div>
        <div className="swatches" role="radiogroup" aria-label="App color">
          {ACCENTS.map((a) => (
            <button key={a.id} role="radio" aria-checked={accent === a.id} aria-label={a.name} title={a.name} className="swatch"
              style={{ ["--c" as string]: a.light, ["--cd" as string]: a.dark }} onClick={() => setAccent(a.id)} />
          ))}
        </div>
      </section>

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

      <SafetyCopies />

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
              const parsed = JSON.parse(await f.text());
              snapshot("Before restoring " + f.name, ["students", "rides", "resources", "lessons", "aircraft"]);
              const r = importLegacy(parsed);
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
              const parsed = JSON.parse(legacy);
              snapshot("Before importing old artifact data", ["students", "rides"]);
              const r = importLegacy(parsed);
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
      <div className="row">
        <span className="small muted">App version: {__BUILD__}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={async () => {
          const r = await checkForUpdate();
          toast(r === "updating" ? "Updating…" : r === "current" ? "You're on the newest version" : "Updates aren't available in this browser");
        }}>Check for updates</button>
        <button className="btn sm" onClick={() => forceRefresh()} title="Reloads the app files from the web. Your students and logs are not touched.">Force refresh</button>
      </div>
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

function SafetyCopies() {
  const snaps = useSnapshots();
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <section className="card">
      <h3>Safety copies</h3>
      <p className="small muted" style={{ margin: 0 }}>
        The app saves a copy before big changes (imports, cleanups, restores, deleting a student or aircraft). Restoring puts things back exactly as they were at that moment, on every device.
      </p>
      {snaps.length === 0 && <div className="small muted">No safety copies yet.</div>}
      {snaps.map((x) => (
        <div key={x.id} className="memberrow">
          <span className="ct" style={{ display: "flex", flexDirection: "column" }}>
            <span className="small" style={{ fontWeight: 600 }}>{x.label}</span>
            <span className="small muted">{new Date(x.at).toLocaleString()}</span>
          </span>
          <span className="spacer" />
          {confirm === x.id ? (
            <>
              <button className="btn danger sm" onClick={() => { restoreSnapshot(x.id); setConfirm(null); toast("Restored"); }}>Restore</button>
              <button className="btn sm" onClick={() => setConfirm(null)}>Cancel</button>
            </>
          ) : <button className="btn sm" onClick={() => setConfirm(x.id)}>Restore</button>}
        </div>
      ))}
    </section>
  );
}
