# SAT-R&R Engineering Validation Platform

A responsive, installable SAT / Run@Rate application built with React, Vite and Supabase. Deployable to Netlify and usable in mobile browsers on Android and iPhone.

## Included

- Email/password authentication using Supabase Auth
- SAT setup: project, customer, machine, harness, engineer and SAT version
- Acceptance criteria and preliminary PASS / FAIL / INCOMPLETE evaluation
- Live run timer, good/rejected counters and five station downtime controls
- Downtime responsibility, category, corrective action and ownership
- Corrective action register
- Historical SAT search and review
- Dashboard KPIs and charts
- CSV export
- PWA manifest and service-worker support for install-to-home-screen

## 1. Supabase setup

1. Open your Supabase project.
2. Go to **SQL Editor** and run `supabase/schema.sql`.
3. In **Authentication → Providers → Email**, enable Email.
4. In **Authentication → URL Configuration**, add your local URL and final Netlify URL to Site URL / Redirect URLs as appropriate.
5. Create `.env` in the project root from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the publishable/anon client key only. Never put a `service_role` or secret key in frontend environment variables.

### User access and data isolation

The SQL creates one profile per authenticated user. The default policy is private ownership: engineers can read and change their own SAT records only. Downtime events and actions inherit access through the SAT record.

To create an administrator, sign up normally, then in Supabase Table Editor → `profiles`, change that user's `role` to `admin`. Do not allow public self-registration to set their own role. This starter currently uses per-user isolation; organization-wide shared SAT visibility and admin user provisioning are a separate policy/workflow decision.

## 2. Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

## 3. Deploy to Netlify

1. Push the project folder to a GitHub repository.
2. In Netlify choose **Add new site → Import an existing project** and connect the repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. In Netlify → Site configuration → Environment variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Deploy the site.
7. Add the final `https://...netlify.app` URL to Supabase Authentication → URL Configuration → Redirect URLs.
8. Redeploy after changing environment variables.

The included `netlify.toml` and `_redirects` handle SPA route fallback.

## 4. Install on Android and iPhone

- **Android:** open the deployed HTTPS URL in Chrome → browser menu → Install app / Add to Home screen.
- **iPhone:** open the deployed HTTPS URL in Safari → Share → Add to Home Screen.

The site must be deployed over HTTPS. PWA installation is not the same as publishing a native app to Google Play or Apple App Store.

## 5. Important engineering definitions

- Gross availability = (elapsed test time − union of machine-impacting downtime intervals) / elapsed test time.
- Overlapping machine stops count once in gross availability.
- Good output rate = accepted good quantity / total elapsed test time.
- Quality = good / (good + rejected) × 100.
- Adjusted availability is retained as a diagnostic concept in the source application; the dashboard emphasizes gross availability.
- Acceptance evaluation only checks configured numerical criteria. It is not a substitute for customer sign-off, safety validation, documentation review, cycle-time stability or contractual SAT requirements.

## 6. Current implementation scope / next engineering decisions

- The current baseline is designed for an individual engineer's private records. For a shared engineering department, define organization membership, admin-managed invitations and organization-level RLS before enabling shared access.
- Offline SAT data entry and background synchronization are not implemented. PWA installation provides an app-like shell; it does not guarantee offline database writes.
- Production quantity controls are manually entered. PLC / MES integration can be added later through a secured backend or Edge Function.
- MTBF / MTTR, Pareto rankings and cycle-time distribution need consistent event and cycle-level data before they can be treated as reliable KPIs.
- Before operational rollout, test RLS using two separate engineer accounts and have the SAT acceptance formula reviewed against the customer's signed acceptance specification.
