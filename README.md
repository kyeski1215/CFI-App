# CFI Cockpit

An installable web app for flight instructors: student roster, mock checkride grading, a logbook reg logger and a resources library. Works on iPhone, iPad and computers, offline in the airplane, and syncs between devices when signed in.

## What's in it

| Tab | What it does |
| --- | --- |
| **Roster** | Students, status, hours, overdue warnings, who's free when. Each student has a profile, lesson log, syllabus checklist, ACS Area I ground checklist, onboarding guide and their mock checkrides. |
| **Mocks** | 794 questions across PPL, IFR, Commercial, CFI, CFII and AMEL, tagged by examiner gouge. Grade S/W/U, add notes, filter to one examiner's gouge, copy a debrief. |
| **Regs** | Tap what you covered, get a compact reg line (e.g. `61.107(b)(1)(i, ii, iv)`) to copy into the logbook, or add it straight to a student's lesson log. |
| **Resources** | Your recommended YouTube videos and links, by rating (Private → CFII, plus General) and topic. Students see the ones for their rating. |
| **Import logbook** | On the Roster: upload a ForeFlight logbook CSV. Instruction flights (dual or ground given) are grouped by the student named on each flight and become lesson log entries, after a preview where you rename, pick the rating, skip, or merge into existing students. Re-importing doesn't duplicate. |
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
3. The project URL and publishable key are already built into `src/lib/sync.ts`. To use a different project, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` (or as GitHub Actions variables for the deployed site).
4. Open the app → Settings → create an account. Everything already on the device uploads.

Without these keys the app still works fully, saving on the device only.

## Shared resource library

Resources added by the library owner show for every CFI and student using the app (other CFIs see them read-only, marked "Library"). Resources anyone else adds stay private to them and their students. Set it up once: Supabase → SQL Editor → run `supabase/sharing-all-in-one.sql` with the owner's account email on the two marked lines (it also sets up the Blitz fleet and access management below).

## Blitz fleet

Aircraft on the library owner's account are visible (read-only) only to Blitz Aviation members and the students they share with. Set up by `supabase/sharing-all-in-one.sql`. The owner then manages who's in Blitz from Settings → Blitz Aviation access (add by email, even before they sign up; remove). Other accounts keep their own private aircraft list.

## Weather

The Weather tab shows METAR/TAF, flight category, density altitude, runway head/crosswinds and a check of each student's solo limits. aviationweather.gov doesn't allow browser requests from other sites, so the app asks a small Supabase Edge Function (no key, no cost):

Supabase → **Edge Functions → Deploy a new function → Via editor** → name it `wx` → paste `supabase/functions/wx/index.ts` → Deploy.

## Student view

Students sign in to the same app and see a read-only **My training** page: progress, the next lesson briefing, homework and videos, ✓/✗ ratings and the texts you made. Your private notes, their phone and availability stay out unless you turn on "Also show my raw lesson notes".

One-time setup: Supabase → **SQL Editor** → run `supabase/student-access.sql`. Keep **Authentication → Providers → Email → Confirm email** turned on (it is by default): that's what proves a student owns the email their card is shared with.

Per student: Edit profile → make sure their email is filled in → Student access → **Share with …** → **Copy invite text** and send it.

## Strengths & needs work

Built on the device, at no cost: when you log a lesson, tap ✓ or ✗ on the skills you covered ("How did it go?"). The Overview lists each skill as a strength (only ✓ in its last 4 ratings), improving (✓ now, ✗ recently) or needs work (✗ on its latest rating), plus weak and solid topics from the latest mock checkride.

## AI summaries (optional, not wired into the app)

`supabase/functions/student-summary` is an Edge Function that sends a student's lesson notes to Claude for an AI-written summary; `summarizeStudent()` in `src/lib/sync.ts` calls it. It is kept for later and has no button in the app, so it uses no API credit.

One-time setup:
1. Get an API key at [console.anthropic.com](https://console.anthropic.com) → API Keys (pay-as-you-go; add a small credit balance).
2. Supabase → **Edge Functions → Deploy a new function → Via editor**. Name it `student-summary`, paste `supabase/functions/student-summary/index.ts`, deploy.
3. Supabase → **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` with your key.

Only signed-in users can call it. The prompt lives at the top of that file if you want to change the style of the summary.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Turn it on once in repo **Settings → Pages → Source: GitHub Actions**.

Then on your phone open the site and **Share → Add to Home Screen**.

## Adding a new module

1. Create `src/pages/MyThing.tsx`.
2. Add a route and a `NAV` entry in `src/App.tsx`.
3. If it stores data, add a collection name to `COLLECTIONS` in `src/lib/store.ts`; it syncs automatically.
