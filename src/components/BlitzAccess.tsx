import { useEffect, useState } from "react";
import { addBlitzMember, listBlitzMembers, removeBlitzMember, type BlitzMember } from "../lib/sync";

/** Settings card for the library owner: who can see the Blitz fleet. */
export default function BlitzAccess() {
  const [list, setList] = useState<BlitzMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setList(await listBlitzMembers());
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => { refresh(); }, []);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await f();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const sorted = [...(list ?? [])].sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.email.localeCompare(b.email));

  return (
    <section className="card">
      <h3>Blitz Aviation access</h3>
      <p className="small muted" style={{ margin: 0 }}>
        CFIs on this list see the Blitz fleet (read-only), and so do the students they share with. Add someone before they sign up: access starts once they create an account with that email and confirm it.
      </p>
      {list === null && !err && <div className="small muted">Loading…</div>}
      {sorted.map((m) => (
        <div key={m.email} className="memberrow">
          <span className="memail">{m.email}</span>
          {m.is_owner ? <span className="pill p-acc">You</span> : m.signed_up ? <span className="pill p-good">Active</span> : <span className="pill p-mute">Not signed up yet</span>}
          <span className="spacer" />
          {!m.is_owner && (confirm === m.email ? (
            <>
              <button className="btn danger sm" disabled={busy} onClick={() => run(() => removeBlitzMember(m.email)).then(() => setConfirm(null))}>Remove</button>
              <button className="btn sm" onClick={() => setConfirm(null)}>Keep</button>
            </>
          ) : <button className="btn ghost sm" onClick={() => setConfirm(m.email)}>Remove</button>)}
        </div>
      ))}
      <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        run(() => addBlitzMember(email)).then(() => setEmail(""));
      }}>
        <input type="email" placeholder="cfi@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} aria-label="CFI email" />
        <button className="btn primary" disabled={busy || !email.trim()}>Add CFI</button>
      </form>
      {err && <div className="small" style={{ color: "var(--bad)" }}>{err}</div>}
    </section>
  );
}
