# ONEVIEW Finance

Internal financial operations and intelligence platform for HACA / ONEVIEW — UAE and India, in native currency, with an explicit AED ↔ INR reporting-currency layer for the combined view.

## Stack

Next.js (App Router) · TypeScript · PostgreSQL (Prisma) · NextAuth · Tailwind CSS · Vitest

## Workspaces

- **Accounts** (`/operations`) — accounts team: inflow/outflow entry, clients, vendors, master data, Zoho Sheets import.
- **Finance View** (`/intelligence`) — management: UAE / India / Combined dashboards, reporting-currency conversion, exchange rate management.

## Getting started

```bash
npm install
npx prisma migrate dev
npm run db:seed        # master data (categories, payment methods, entities)
npm run dev
```

See `.env.example` for required environment variables.

## Testing

```bash
npm test
```

## Deployment (Vercel)

Environment variables: see `.env.example`. Set `DATABASE_URL`, `DIRECT_URL`,
`AUTH_SECRET`, `NEXTAUTH_SECRET`. Leave `NEXTAUTH_URL` **unset** — `trustHost`
lets Auth.js derive it from Vercel's headers, which is what makes preview
deployments work.

### Function region must match the database region

`vercel.json` pins serverless functions to `sin1` (Singapore) because the Neon
database lives in `ap-southeast-1` (Singapore).

This is not a micro-optimisation. Vercel defaults to `iad1` (Washington DC), and
with the database in Singapore *every* query round-trips halfway around the
world: a bare `SELECT 1` measured **1.5s**, and a dashboard issuing 10+ queries
took many seconds. Same-region brings that to single-digit milliseconds.

**If you ever move the database, change this region to match it** — otherwise
the app silently becomes slow again in a way that looks like a database problem
but isn't.
