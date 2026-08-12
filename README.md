# ONEVIEW Finance

Internal financial operations and intelligence platform for HACA / ONEVIEW — UAE and India, in native currency, with an explicit AED ↔ INR reporting-currency layer for the combined view.

## Stack

Next.js (App Router) · TypeScript · PostgreSQL (Prisma) · NextAuth · Tailwind CSS · Vitest

## Workspaces

- **Financial Operations** (`/operations`) — accounts team: inflow/outflow entry, clients, vendors, master data, Zoho Sheets import.
- **Financial Intelligence** (`/intelligence`) — management: UAE / India / Combined dashboards, reporting-currency conversion, exchange rate management.

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
