# Giftly 🎁

A mobile-first gifting delivery MVP. Customers browse gifts from local stores and send
them to someone with a message; store owners fulfill their own orders; admins oversee the
whole platform. **Demo application — no real payments or deliveries.**

Built with Next.js 14 (App Router) + TypeScript, Tailwind CSS, Prisma ORM, and PostgreSQL.

---

## 1. Tech stack

- **Next.js 14** (App Router, TypeScript) on Vercel
- **PostgreSQL** (Neon via Vercel Marketplace, or any Postgres instance)
- **Prisma ORM** — schema + committed migrations in `prisma/`
- **Prisma Client** (standard `prisma-client-js` generator). `prisma generate` runs on
  every install (`postinstall`) and again in `npm run build`, so Vercel's dependency cache
  can never serve a stale client
- **Tailwind CSS**, **lucide-react** icons, a small set of hand-built + Radix-based UI
  primitives (no full shadcn CLI dependency, to keep the dependency tree predictable)
- **React Hook Form + Zod** for forms and shared client/server validation
- **jose** for signed, HttpOnly, expiring session cookies (custom lightweight auth — no
  third-party auth provider needed for a demo-login-only app)
- **Vitest** for unit + integration tests

## 2. Local setup

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local Postgres, or a free Neon project — see §5)

### Steps

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, DIRECT_URL, and SESSION_SECRET
npx prisma migrate deploy   # applies the committed migrations in prisma/migrations/
npm run db:seed             # seeds demo cities, stores, products, orders, and accounts (reads .env)
npm run dev                 # http://localhost:3000
```

> `npm install` runs `prisma generate` automatically via `postinstall`. The first time you
> run any Prisma command, it downloads a small schema-engine binary from
> `binaries.prisma.sh` (a one-time, normal step) — make sure outbound network access to
> that host is available in whatever environment you install in.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection string, used at runtime |
| `DIRECT_URL` | Yes (for migrations) | Direct (non-pooled) Postgres connection, used by `prisma migrate` |
| `SESSION_SECRET` | Yes | Random secret (32+ bytes) used to sign session cookies. Generate with `openssl rand -base64 32` |

If `DATABASE_URL` is missing, every page and API route returns a clear
"setup required" message (HTTP 503) instead of silently falling back to a fake backend.

### Demo credentials

All demo accounts use the password **`Demo@1234`**.

| Role | Email | Notes |
|---|---|---|
| Customer | `customer@giftapp.demo` | Order history, 3 reminders and 2 group gifts |
| Customer | `customer2@giftapp.demo` | Separate orders, 3 reminders and 2 group gifts |
| Store Owner | `store@giftapp.demo` | Owns **Petals & Co.** (Hyderabad) — has a pending order |
| Store Owner | `cakecraft@giftapp.demo` | Owns **CakeCraft** (Hyderabad) |
| Store Owner | `giftstudio@giftapp.demo` | Owns **The Gift Studio** (Hyderabad) |
| Store Owner | `bloom@giftapp.demo` | Owns **Bloom & Co.** (Hyderabad) |
| Store Owner | `cakecraft.blr@giftapp.demo` | Owns **CakeCraft** (Bengaluru) — demonstrates city filtering |
| Store Owner | `teststore2@giftapp.demo` | Owns **Petals Bengaluru** (Bengaluru) |
| Store Owner | `customcreations@giftapp.demo` | Owns **Custom Creations** (Hyderabad) |
| Store Owner | `greenthumb@giftapp.demo` | Owns **Green Thumb Nursery** (Bengaluru) |
| Admin | `admin@giftapp.demo` | Platform-wide orders, revenue, rejection analytics and users |

The `/login` page also has one-tap "Use demo Customer / Store Owner / Admin" buttons.

**Testing multiple roles at once:** use separate browser profiles or private/incognito
windows per role — ordinary tabs in the same browser share the same session cookie, so a
second tab logging in as a different role will replace the first tab's session too.

## 3. Database notes

- Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/` (init, group gifts &
  reminders, user phone, store hours, cart, mock card payment).
- All monetary values are `Decimal(10,2)`; delivery fees are fixed (₹49 standard, ₹99
  express, ₹79 scheduled) and totals are **always recalculated server-side** — the client's
  displayed total is only used to detect drift and force a re-review.
- `Order.version` is used for optimistic concurrency: every status transition checks and
  increments it, so a stale/concurrent update is rejected with a clear conflict error
  rather than silently overwriting a newer change.
- `OrderStatusHistory` is append-only and immutable; admin overrides are recorded there
  with `isAdminOverride = true` and a mandatory reason, and nothing is ever deleted or
  rewritten. "Skipped" steps in the tracking timeline are *derived* at render time by
  comparing the current status against which steps have a real recorded timestamp — no
  fabricated timestamps are ever written to the database.
- Editing a product never changes past orders: `OrderItem` snapshots `productName` and
  `unitPrice` at the moment the order is placed.

### Populating the demo

Run `npm run db:seed` after migrations against the database used by the app. A fresh
seed includes 11 demo accounts, 8 stores, 41 products, 90 orders, 6 reminders and 4
group gifts. Every store owner has new, active, delivered and rejected orders;
customer group gifts show both partial and complete funding. Prices, delivery fees,
contribution totals and tracking histories agree with the application rules.

Photos are bundled under `public/images/demo/` with source credits in that folder.
Images load from your deployment rather than a third-party image server. The data is
synthetic and uses the existing demo accounts; no real payments or deliveries occur.

The seed creates missing demo records and preserves existing orders, contributions,
reminders, passwords and catalogue edits when rerun. Original seed photo URLs are
upgraded to bundled images. Dates are relative to the first seed run and are not
reset on later runs. Use the dev reset below only for a disposable local database.

**Existing Vercel deployment:** deploying code does not populate its database.
Run `npm run db:seed` once with that deployment's database environment variables,
after migrations. Do not add seeding to the build or run a reset on the deployed database.

### Resetting local data

```bash
npm run db:reset:dev   # truncates all tables - refuses to run if NODE_ENV=production
npm run db:seed        # repopulate
```

This script is a CLI-only tool, not an HTTP endpoint — it's never reachable from the
deployed app.

## 4. Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build without database changes |
| `npm run build:vercel` | Apply pending migrations, then build for Vercel |
| `npm run start` | Start the production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the Vitest suite (needs `DATABASE_URL` for integration tests) |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate deploy` (production-safe, no prompts) |
| `npm run db:migrate:dev` | `prisma migrate dev` (local, interactive) |
| `npm run db:seed` | Seed demo data (idempotent — safe to re-run) |
| `npm run db:reset:dev` | Dev-only: truncate all tables |

## 5. Deploying to Vercel + Neon

1. Push this repository to GitHub.
2. In Vercel, **New Project** → import the repo.
3. Add a **Neon Postgres** integration from the Vercel Marketplace (or connect your own
   Postgres). This sets `DATABASE_URL` and a pooled/direct URL pair automatically — map
   them to `DATABASE_URL` and `DIRECT_URL` in Vercel's Environment Variables if the
   integration uses different names.
4. Add `SESSION_SECRET` as an environment variable (generate with `openssl rand -base64 32`).
   **Never** prefix it with `NEXT_PUBLIC_`.
5. Deploy. `vercel.json` sets the Build Command to `npm run build:vercel`:
   pending Prisma migrations run **before** the Next.js build. A failed migration
   fails the deployment, so new code is not published against an older schema.
   This includes the `CARD_MOCK` enum update required by credit-card checkout.
   Node 20+ is required (`engines` in `package.json`). If an existing project has
   a custom Build Command, ensure it uses `npm run build:vercel`.
6. Populate demo records separately, with both database variables pointing to the
   intended deployment database:
   ```bash
   npm run db:seed
   ```
   Seeding is never part of the build. No database reset is needed.
7. Configure a separate database and both database URLs for preview deployments
   so their migrations and test data stay isolated from production. `DIRECT_URL`
   must point to the same database as `DATABASE_URL` and allow migrations.

**Existing credit-card checkout error:** deployments made before this build change
may lack `20261004000000_mock_card_payment`. Redeploy with the build command above,
or run `npm run db:migrate` using that deployment's database variables before
starting the app. The migration preserves existing orders and payment records.
Card and UPI remain mock payments; neither collects money.

## 6. A three-role demo walkthrough

1. Open `/login` in one browser profile → **Use demo Customer**. Pick Hyderabad, browse to
   **Petals & Co.** → **Blush Love Bouquet** → place a mock order. You'll land on the
   confirmation screen: *"Order placed — waiting for the store to accept."*
2. Open a **second, separate browser profile** → `/login` → **Use demo Store Owner**
   (`store@giftapp.demo`). Go to **Orders** → find the new order → **Accept** → advance it
   through Preparing Gift → Ready for Pickup → Out for Delivery → Delivered.
3. Back in the customer tab, open **My Orders** → tap the order → the tracking timeline
   reflects each update (polls every 15s, or tap Refresh). After the store marks
   Delivered, upload a delivery photo, tick the confirmation checkbox, and choose
   **Confirm Delivery**. The store then sees **Customer confirmed delivery**, the
   photo, and the confirmation time.
4. Open a **third profile** → `/login` → **Use demo Admin**. Go to **Orders**, open the
   same order, and try **Override status** — pick any status, give a reason, confirm. The
   immutable history list shows the override with its reason, actor, and timestamp, and
   nothing is deleted from the record of what the store owner actually did.

## 7. Known limitations / what's intentionally out of scope

This MVP deliberately does **not** include: multi-store orders (a cart can only hold items
from one store at a time), real payment processing, a rider app or live delivery tracking,
registration/OTP/password-recovery flows, coupons, or a full support/ticketing platform.
"AI Gift Assistant" is shown as a **Coming soon** teaser on the home screen.

## 8. What was verified before delivery

Everything below was actually run, not assumed:

- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors (3 informational warnings, documented in code comments)
- `npm run build` — succeeds; all 35 routes compile, correctly split between static and
  dynamic
- `npm run test` — **39/39 tests passing**, including integration tests that exercise
  `createOrder`, store-owner transitions, admin overrides, and price-snapshot integrity
  against a real PostgreSQL database (not mocks)
- A hand-written SQL migration was applied to a real Postgres instance and a full
  create → read → delete smoke test confirmed Prisma Client works correctly in the
  no-Rust-engine / driver-adapter configuration
- A full HTTP smoke test against the running production build: login → session cookie
  issuance → unauthenticated requests correctly blocked (401) → cross-role requests
  correctly blocked (403) → a real order placed → idempotent retry returned the same
  order (no duplicate) → the store owner saw and accepted it → the customer's tracking
  view reflected the update → the admin overrode the status with a reason and the
  override was recorded in the immutable history
- The seed script was run against a real database and confirmed idempotent (a second run
  skips existing records rather than duplicating them)

No deployment or GitHub repository URL is claimed here, since creating those requires your
own GitHub/Vercel/Neon accounts — the steps above are exact and ready to follow.

### HTML reference alignment

`public/prototype.html` remains the design reference. Customer browsing now uses
circular featured gifts, square store cards, full store pages, product quick views,
store filters, quantity controls, and a separate cart summary and shared checkout.
Adding a gift from another store asks **“Would you like to clear the cart?”** with
Cancel and Clear cart & add actions. The server validates and replaces the cart in
one transaction; unavailable gifts cannot erase the existing cart.

Reminder recurrence, lead time, preferred category and notes are editable. Group
gifts use the same checkout, and store/admin screens include the reference's
search, filters, photos, order queue actions and performance summaries. Existing
moderation, archiving, delivery validation and demo data remain supported.

Apply migrations with `npm run db:migrate` before running the updated application.
The new migration adds `CARD_MOCK` for the prototype's credit-card payment choice;
it does not collect card details or process a real payment. New checkouts accept only mock Card and UPI payments.
Historical payment records remain readable. Seeding mock data remains an explicit, separate step.

### Reference layout and payment choices

The application follows the HTML reference's centered 480px layout on desktop
and fills the available width on phones. The sign-in card, customer header,
profile menu and bottom navigation follow the same layout. Store Reports and
Store profile remain available from the dashboard and account menu; admin Users
is available from the account menu.

Featured gifts stay in one horizontal row: swipe or scroll sideways to see the
rest. Popular stores use two square cards per row, with more rows available by
scrolling down within the store section, matching the HTML reference. Both scroll
areas also support keyboard navigation.

Checkout offers **UPI** and **Credit Card** only. Both are mock payments; no money
is collected. Both checkout APIs reject Pay on Delivery requests. New demo seeds
also use only Card and UPI; existing historical order payment records are retained.


### Demonstrating customer delivery confirmation

Seeding adds **20 delivered orders awaiting a customer photo**: ten each for
`customer@giftapp.demo` and `customer2@giftapp.demo`, with order codes starting
`GF-PHOTO-CUSTOMER-` and `GF-PHOTO-CUSTOMER2-`. They are distributed across the eight
demo stores and have no proof image or customer confirmation initially.

- Customer: open **Orders → Awaiting photo**, select an order, upload a photo,
  tick the confirmation checkbox, then choose **Confirm Delivery**.
- Store owner: open **Orders → Completed**, then filter **Awaiting photo** or
  **Customer confirmed**. Open the order to see its photo, confirmation time and
  status history. The order page refreshes automatically every 15 seconds and
  when the window regains focus; a Refresh button is also available.

Run `npm run db:seed` against the intended demo deployment database to add these
records. Rerunning the seed preserves existing orders and submitted photos; it
never resets customer confirmations. This feature requires no new migration.

### Store delivery and customer verification

The store advances an order through **Out for Delivery → Delivered** using the
order's action button. Marking Out for Delivery keeps the order in transit until
the owner explicitly marks Delivered. This unlocks the customer's photo upload;
the order stays **Awaiting customer photo** until the customer uploads a photo
and confirms receipt. Only that customer's confirmation marks it verified.
