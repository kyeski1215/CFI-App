# CFI Cockpit

An installable web app for flight instructors: student roster, mock checkride grading, a logbook reg logger and a resources library. Works on iPhone, iPad and computers, offline in the airplane, and syncs between devices when signed in.

## What's in it

| Tab | What it does |
| --- | --- |
| **Roster** | Students, status, hours, overdue warnings, who's free when. Each student has a profile, lesson log, syllabus checklist, ACS Area I ground checklist, onboarding guide and their mock checkrides. |
| **Mocks** | 794 questions across PPL, IFR, Commercial, CFI, CFII and AMEL, tagged by examiner gouge. Grade S/W/U, add notes, filter to one examiner's gouge, copy a debrief. |
| **Regs** | Tap what you covered, get a compact reg line (e.g. `61.107(b)(1)(i, ii, iv)`) to copy into the logbook, or add it straight to a student's lesson log. |
| **Resources** | Your artifacts and FAA/weather links. Add your own, pin, edit, hide. |
| **Settings** | Sign in for sync, backup/restore, import from the old artifacts. |

Content came from the earlier Claude artifacts and lives in `src/data/*.json` and `src/lib/{regs,resources,curriculum}.ts`.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Turn on cloud sync (one-time, ~10 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project: **SQL Editor → New query**, paste `supabase/schema.sql`, run it.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
4. For local dev, copy `.env.example` to `.env.local` and fill them in.
   For the deployed site, add them as GitHub repo **Settings → Secrets and variables → Actions → Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. (The anon key is meant to be public; row-level security keeps each user's data private.)
5. Open the app → Settings → create an account. Everything already on the device uploads.

Without these keys the app still works fully, saving on the device only.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Turn it on once in repo **Settings → Pages → Source: GitHub Actions**.

Then on your phone open the site and **Share → Add to Home Screen**.

## Adding a new module

1. Create `src/pages/MyThing.tsx`.
2. Add a route and a `NAV` entry in `src/App.tsx`.
3. If it stores data, add a collection name to `COLLECTIONS` in `src/lib/store.ts`; it syncs automatically.
