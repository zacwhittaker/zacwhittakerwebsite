# Bet Board

A standalone Vite app inside the portfolio repo. The public dashboard has four individual player pages with animated performance charts; invited users can add and settle their own bets. The intended address is **https://bet.zwo08.co.uk**.

## Run locally

```sh
cd bet
npm ci
npm run dev
```

With both environment variables absent, the app runs an explicitly labelled preview. Choose **Try the demo**, then a person. Add a bet and settle it through **My bets**. Sample data and changes exist only in memory and reset on reload. There are no fake credentials or demo writes to Supabase.

For live data, copy `.env.example` to `.env.local` and set the Supabase project URL and its **publishable** key. The legacy public anon key also works. Never use a secret or service-role key in a `VITE_` variable. Restart the dev server after changing environment variables. Partial configuration reports an error instead of falling back to sample data.

```sh
npm test
npm run build
npm run preview
```

Tests cover exact penny calculations and date windows, plus the actual SQL migration and database permissions using an isolated PostgreSQL runtime (PGlite). They do not contact production Supabase or send emails.

## Connect Supabase

1. Create a dedicated Supabase project; choose the London region if available.
2. Run `supabase/migrations/202609250001_bet_board.sql` and then `supabase/migrations/202609250002_player-pages-and-cashout.sql` in order in the SQL editor of that new project. The first creates the four profiles, bets, grants, row policies and RPC functions; the second adds career metrics and early cash-out settlement. Do not apply the first migration to an unrelated existing database with tables of the same name. If migration 001 is already applied, run only migration 002.
3. In **Authentication → Providers → Email**, enable email/password. In **Authentication → General configuration**, disable new user sign-ups and anonymous sign-ins. Set the minimum password length to 12.
4. Set **Site URL** to `https://bet.zwo08.co.uk`. Allow these exact redirect URLs:
   - `https://bet.zwo08.co.uk/`
   - `https://bet.zwo08.co.uk/?auth=recovery`
   - The same paths on your local development origin when you need to exercise auth locally.
5. Configure Resend as custom SMTP in Supabase for invitation and reset emails. Verify a sending subdomain such as `auth.zw08.co.uk` in Resend using its supplied DNS records at Porkbun; use a sender such as `Bet Board <no-reply@auth.zw08.co.uk>`. Enter the SMTP settings from the Resend dashboard into Supabase. Disable email link tracking to preserve single-use authentication URLs. Supabase's default email service is restricted to project team addresses, so it is not sufficient for these invitations.
6. The owner invites each of the four people through **Authentication → Users → Invite user**. Do not add friends as Supabase organization members. After invitations create their auth records, map each exact email to a player in the SQL editor using the template below. Replace placeholders privately; do not commit real addresses.

```sql
update public.profiles
set user_id = (select id from auth.users where lower(email) = lower('INVITED_EMAIL'))
where slug = 'zac';
-- Repeat for adrian, dylan and sam with each person's address.

-- All four should show true before use:
select slug, user_id is not null as account_linked
from public.profiles;
```

Invitation links open the app's password setup dialog. Recovery links open the same flow. Expired links can be replaced through Supabase; the app offers password reset for existing accounts. Each user is linked to exactly one fixed profile, and no user can change that association from the browser.

## Deploy the folder from this same repo

1. Import the existing `zacwhittakerwebsite` GitHub repository into a new Vercel project named `zw-bet-board`.
2. Select **Root Directory: `bet`**, framework **Vite**, install **`npm ci`**, build **`npm run build`**, output **`dist`**.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Production environment variables before deploying. These are public client configuration. Keep preview deployments without these values to use isolated demo data; do not let routine previews write to the live database.
4. In that Vercel project's Domains settings, add **`bet.zwo08.co.uk`**. Vercel will provide the exact DNS target.
5. At Porkbun, add a **CNAME** record with host **`bet`** and the target Vercel supplies. Configure this specific host, not a wildcard. Wait for Vercel to confirm DNS and issue HTTPS.
6. Exercise invitation, login, reset, add and settle with the intended four users. Publicly check that the charts update after a settlement.

The portfolio keeps its existing GitHub Pages deployment and root `CNAME`. The tracker has its own package, lockfile, build output and Vercel deployment. There are no portfolio navigation links to it. `noindex` and `robots.txt` discourage search indexing, but the dashboard is intentionally public and these directives are not access controls.

## Rules and public API

- All money is stored as integer pence. Maximum stake is £1,000,000. Fractional odds use positive integer components up to 1,000,000. Decimal odds accept up to six decimal places, must exceed 1 and cannot exceed 1,000,000.
- Fractional profit is calculated from the exact numerator and denominator, rather than a rounded decimal conversion. Final payouts round half up to the nearest penny. A win adds the profit, a loss subtracts the stake, and a void records zero profit.
- Bets begin pending. Stake, description and odds become immutable after insertion. Owners settle them once through a database function. The final result cannot be reopened in the app. No direct client insert, update or delete grants exist.
- `create_bet(id, description, stake_pence, odds_format, odds_text, placed_at)` derives the owner from the authenticated user. Repeating the same request ID and payload returns the saved bet; reusing it with different details is rejected.
- `settle_bet(id, status, cashout_odds_format, cashout_odds_text)` atomically settles an owned pending bet. For a cash-out, enter the reduced odds accepted; net profit is stake × (decimal cash-out odds − 1), rounded half up to a penny. Won/lost/void results continue to use the original odds, stake, and zero profit respectively.
- `get_public_dashboard(since)` exposes display profiles, daily aggregates, totals, pending exposure, counts and per-player career metrics. No emails, auth user IDs, selections or bet IDs are returned. Bet records and each user's profile are accessible only to their owner through RLS.
- Time windows use Europe/London calendar days. Staked totals use placement dates; profit and win rate use settlement dates. Charts start at zero at the beginning of the chosen window. Open exposure always includes all outstanding bets, including older ones. Win rate excludes voids and pending bets.
- The page refreshes live aggregates every 30 seconds while visible, on returning to the tab and immediately after a mutation. A failed refresh retains the last good results and shows a connection warning. The preview does not poll.
- No bets are placed with a bookmaker and no money is moved. This is a record of bets users have already placed elsewhere. Each-way settlements, free bets and bookmaker integrations are outside this version; early cash-outs use the reduced odds accepted. Accumulators can be recorded as a single selection with their combined odds.

## Free services and operations

Supabase Free provides 500 MB of database storage and may pause after a week of inactivity; restore a paused project in the dashboard. Resend's published free allowance is 3,000 emails monthly with a 100-per-day limit. Check current account limits before launch. Export a database backup periodically; automatic downloadable backups are not included in Supabase Free.

To undo a frontend release, roll back the tracker deployment in Vercel. The migration is additive and the database can retain the existing bets. Do not delete the Supabase project as a deployment rollback.

Sources: [Vercel folder deployments](https://vercel.com/docs/monorepos), [Vercel domain setup](https://vercel.com/docs/domains/set-up-custom-domain), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase pricing](https://supabase.com/pricing), [Resend pricing](https://resend.com/pricing).
