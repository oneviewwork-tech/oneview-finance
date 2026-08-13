/**
 * Demo/testing data — NOT part of the production seed (prisma/seed.ts).
 * Populates realistic UAE + India transactions so the UI can be reviewed
 * with real-looking data instead of empty states everywhere. Safe to
 * re-run (skips if demo data already exists) and safe to wipe later:
 * every transaction/client/vendor this script creates has its
 * description/name traceable back to this file for cleanup.
 *
 * Run: npm run db:seed-demo
 */
import { PrismaClient, Prisma, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calculateStatus } from "../src/domain/finance/calculations";

const prisma = new PrismaClient();
const { Decimal } = Prisma;

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Shifts a date by whole months, clamping the day so month-ends never roll over. */
function shiftMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

interface OutflowSeed {
  date: Date;
  description: string;
  category: string;
  expenseType: string;
  amountDue: string;
  amountPaid: string; // "0" for PENDING
  paymentMethod?: string;
  vendor?: string;
  /** Left undefined for company-wide overhead that isn't one team's cost. */
  department?: string;
}

interface InflowSeed {
  date: Date;
  clientName: string;
  clientType: string;
  description: string;
  dealValue: string;
  amountReceived: string;
  paymentMethod?: string;
  closedBy?: string;
  /** The team delivering the work — what makes a department a profit centre. */
  department?: string;
}

// Service teams, not cost buckets: a client buys SEO or a website, and the
// team that delivers it both earns the fee and incurs the costs. Operations
// is deliberately included as a pure overhead team — it never earns, which is
// what every department looked like before inflow could be tagged.
const DEPARTMENTS = [
  "Social Media",
  "Web Development",
  "SEO & Content",
  "Paid Ads",
  "Branding & Creative",
  "Operations",
];

const UAE_OUTFLOW: OutflowSeed[] = [
  { date: d(2026, 8, 1), description: "Base Salary — August", category: "Salaries & Allowances", expenseType: "Current Month", amountDue: "32000", amountPaid: "32000", paymentMethod: "Bank Transfer" },
  { date: d(2026, 8, 1), description: "Sales Team Salary — August", category: "Salaries & Allowances", expenseType: "Current Month", amountDue: "18500", amountPaid: "18500", paymentMethod: "Bank Transfer" },
  { date: d(2026, 8, 3), description: "Office Rent — August", category: "Rent & Utilities", expenseType: "Current Month", amountDue: "22000", amountPaid: "15000", paymentMethod: "Cheque", department: "Operations" },
  { date: d(2026, 8, 4), description: "Etisalat Business Bill", category: "Telecom & Internet", expenseType: "Current Month", amountDue: "1450", amountPaid: "1450", paymentMethod: "Auto-Debit", department: "Operations" },
  { date: d(2026, 8, 5), description: "Client Dinner — Marina Bay", category: "Travel & Meeting", expenseType: "Current Month", amountDue: "2100", amountPaid: "0" },
  { date: d(2026, 8, 6), description: "New Laptops x2", category: "Equipment", expenseType: "Current Month", amountDue: "8600", amountPaid: "8600", paymentMethod: "Card", vendor: "Emirates Office Supplies", department: "Operations" },
  { date: d(2026, 8, 8), description: "Video Editor — Freelance", category: "Freelancers & Production", expenseType: "Current Month", amountDue: "4200", amountPaid: "2000", paymentMethod: "Bank Transfer", department: "Branding & Creative" },
  { date: d(2026, 8, 9), description: "Google Ads — August", category: "Marketing & Advertising", expenseType: "Current Month", amountDue: "12000", amountPaid: "12000", paymentMethod: "Card", department: "Paid Ads" },
  { date: d(2026, 8, 9), description: "Instagram Campaign — Ramadan Prep", category: "Marketing & Advertising", expenseType: "Current Month", amountDue: "6500", amountPaid: "0", department: "Social Media" },
  { date: d(2026, 8, 10), description: "Adobe Creative Cloud", category: "Software & Subscriptions", expenseType: "Current Month", amountDue: "980", amountPaid: "980", paymentMethod: "Card", department: "Branding & Creative" },
  { date: d(2026, 8, 10), description: "Notion Team Plan", category: "Software & Subscriptions", expenseType: "Current Month", amountDue: "450", amountPaid: "450", paymentMethod: "Card", department: "Operations" },
  { date: d(2026, 8, 11), description: "Employee Visa Renewal", category: "Visa & Government Fees", expenseType: "Current Month", amountDue: "5200", amountPaid: "0", department: "Operations" },
  { date: d(2026, 8, 11), description: "WPS Processing Fee", category: "Bank & Salary Charges", expenseType: "Current Month", amountDue: "320", amountPaid: "320", paymentMethod: "Auto-Debit", department: "Operations" },
  { date: d(2026, 8, 7), description: "BD Commission — July", category: "Incentives & Commissions", expenseType: "Old Dues / Arrears", amountDue: "7800", amountPaid: "5000", paymentMethod: "Bank Transfer" },
  { date: d(2026, 8, 2), description: "Pantry Supplies", category: "Office & Misc", expenseType: "Current Month", amountDue: "650", amountPaid: "650", paymentMethod: "Cash", vendor: "Emirates Office Supplies", department: "Operations" },
  { date: d(2026, 8, 6), description: "July Freelancer Balance", category: "Old Dues / Arrears", expenseType: "Old Dues / Arrears", amountDue: "3200", amountPaid: "0", department: "Web Development" },
];

const UAE_INFLOW: InflowSeed[] = [
  { date: d(2026, 8, 2), clientName: "Gulf Retail LLC", clientType: "New Client", description: "SMM Retainer — 6 months", dealValue: "45000", amountReceived: "45000", paymentMethod: "Bank Transfer", closedBy: "Aswin KP", department: "Social Media" },
  { date: d(2026, 8, 3), clientName: "Desert Rose Trading", clientType: "Existing Client", description: "Website Revamp", dealValue: "38000", amountReceived: "20000", paymentMethod: "Bank Transfer", closedBy: "Aswin KP", department: "Web Development" },
  { date: d(2026, 8, 5), clientName: "Al Noor Enterprises", clientType: "Renewal", description: "Annual SEO Contract", dealValue: "60000", amountReceived: "60000", paymentMethod: "Cheque", closedBy: "Fathima R", department: "SEO & Content" },
  { date: d(2026, 8, 6), clientName: "Falcon Wings Aviation", clientType: "One-Time Project", description: "Branding Package", dealValue: "25000", amountReceived: "10000", paymentMethod: "Bank Transfer", closedBy: "Fathima R", department: "Branding & Creative" },
  { date: d(2026, 8, 7), clientName: "Marina Bay Hospitality", clientType: "New Client", description: "Social Media Management", dealValue: "18000", amountReceived: "0", closedBy: "Aswin KP", department: "Social Media" },
  { date: d(2026, 8, 8), clientName: "Oasis Wellness Spa", clientType: "Upsell", description: "Paid Ads Add-on", dealValue: "12000", amountReceived: "12000", paymentMethod: "Card", closedBy: "Fathima R", department: "Paid Ads" },
  { date: d(2026, 8, 9), clientName: "Skyline Real Estate", clientType: "Existing Client", description: "Content Marketing", dealValue: "30000", amountReceived: "15000", paymentMethod: "Bank Transfer", closedBy: "Aswin KP", department: "SEO & Content" },
  { date: d(2026, 8, 10), clientName: "Nova Tech Solutions", clientType: "New Client", description: "App Store Optimization", dealValue: "22000", amountReceived: "22000", paymentMethod: "Online", closedBy: "Fathima R", department: "Web Development" },
];

const UAE_VENDORS = ["Dubai Print Co", "Gulf Facilities Management", "Emirates Office Supplies"];

const INDIA_OUTFLOW: OutflowSeed[] = [
  { date: d(2026, 8, 1), description: "August Payroll", category: "Salaries & Allowances", expenseType: "Current Month", amountDue: "850000", amountPaid: "850000", paymentMethod: "Bank Transfer" },
  { date: d(2026, 8, 2), description: "Office Rent — Bangalore", category: "Rent & Utilities", expenseType: "Current Month", amountDue: "145000", amountPaid: "100000", paymentMethod: "Bank Transfer", department: "Operations" },
  { date: d(2026, 8, 3), description: "Airtel Business Broadband", category: "Telecom & Internet", expenseType: "Current Month", amountDue: "18000", amountPaid: "18000", paymentMethod: "Auto-Debit", department: "Operations" },
  { date: d(2026, 8, 4), description: "Client Visit — Mumbai", category: "Travel & Meeting", expenseType: "Current Month", amountDue: "32000", amountPaid: "0" },
  { date: d(2026, 8, 5), description: "Desktop Workstations", category: "Equipment", expenseType: "Current Month", amountDue: "185000", amountPaid: "185000", paymentMethod: "Bank Transfer", vendor: "Reliance Digital Enterprise", department: "Operations" },
  { date: d(2026, 8, 6), description: "Content Writers — Freelance", category: "Freelancers & Production", expenseType: "Current Month", amountDue: "65000", amountPaid: "30000", paymentMethod: "Bank Transfer", department: "SEO & Content" },
  { date: d(2026, 8, 8), description: "Meta Ads — August", category: "Marketing & Advertising", expenseType: "Current Month", amountDue: "220000", amountPaid: "220000", paymentMethod: "Card", department: "Paid Ads" },
  { date: d(2026, 8, 9), description: "LinkedIn Campaign", category: "Marketing & Advertising", expenseType: "Current Month", amountDue: "95000", amountPaid: "0", department: "Paid Ads" },
  { date: d(2026, 8, 9), description: "Microsoft 365 Business", category: "Software & Subscriptions", expenseType: "Current Month", amountDue: "42000", amountPaid: "42000", paymentMethod: "Card", department: "Operations" },
  { date: d(2026, 8, 10), description: "GST Filing Charges", category: "Visa & Government Fees", expenseType: "Current Month", amountDue: "15000", amountPaid: "0", department: "Operations" },
  { date: d(2026, 8, 10), description: "NEFT Processing Fee", category: "Bank & Salary Charges", expenseType: "Current Month", amountDue: "4500", amountPaid: "4500", paymentMethod: "Auto-Debit", department: "Operations" },
  { date: d(2026, 8, 7), description: "Sales Team Bonus", category: "Incentives & Commissions", expenseType: "Current Month", amountDue: "120000", amountPaid: "80000", paymentMethod: "Bank Transfer" },
  { date: d(2026, 8, 2), description: "Office Supplies", category: "Office & Misc", expenseType: "Current Month", amountDue: "12000", amountPaid: "12000", paymentMethod: "Cash", department: "Operations" },
  { date: d(2026, 8, 6), description: "June Vendor Balance", category: "Old Dues / Arrears", expenseType: "Old Dues / Arrears", amountDue: "48000", amountPaid: "0", department: "Web Development" },
];

const INDIA_INFLOW: InflowSeed[] = [
  { date: d(2026, 8, 2), clientName: "Zenith Retail Pvt Ltd", clientType: "New Client", description: "Digital Marketing Retainer", dealValue: "480000", amountReceived: "480000", paymentMethod: "Bank Transfer", closedBy: "Priya Menon", department: "Social Media" },
  { date: d(2026, 8, 4), clientName: "Bharat Textiles", clientType: "Existing Client", description: "Website Development", dealValue: "350000", amountReceived: "200000", paymentMethod: "Bank Transfer", closedBy: "Priya Menon", department: "Web Development" },
  { date: d(2026, 8, 5), clientName: "Aurora Hospitality Group", clientType: "Renewal", description: "Annual SEO Contract", dealValue: "600000", amountReceived: "600000", paymentMethod: "Cheque", closedBy: "Rohan Iyer", department: "SEO & Content" },
  { date: d(2026, 8, 6), clientName: "Vertex Financial Services", clientType: "One-Time Project", description: "Brand Strategy", dealValue: "275000", amountReceived: "100000", paymentMethod: "Bank Transfer", closedBy: "Rohan Iyer", department: "Branding & Creative" },
  { date: d(2026, 8, 8), clientName: "Prime Realty Ventures", clientType: "New Client", description: "Social Media Management", dealValue: "180000", amountReceived: "0", closedBy: "Priya Menon", department: "Social Media" },
  { date: d(2026, 8, 9), clientName: "Sunrise Foods Pvt Ltd", clientType: "Upsell", description: "Paid Campaign Add-on", dealValue: "95000", amountReceived: "95000", paymentMethod: "Online", closedBy: "Rohan Iyer", department: "Paid Ads" },
  { date: d(2026, 8, 10), clientName: "Metro Logistics India", clientType: "Existing Client", description: "Content Marketing", dealValue: "220000", amountReceived: "110000", paymentMethod: "Bank Transfer", closedBy: "Priya Menon", department: "SEO & Content" },
];

const INDIA_VENDORS = ["Reliance Digital Enterprise", "Bangalore Facility Services"];

async function seedEntity(
  entityCode: string,
  currency: "AED" | "INR",
  outflows: OutflowSeed[],
  inflows: InflowSeed[],
  vendorNames: string[]
) {
  const entity = await prisma.businessEntity.findUniqueOrThrow({ where: { code: entityCode } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });

  const existing = await prisma.financialTransaction.count({ where: { entityId: entity.id } });
  if (existing > 0) {
    console.log(`${entityCode}: already has ${existing} transactions — skipping (safe to re-run only on an empty entity)`);
    return;
  }

  const [categories, expenseTypes, paymentMethods, clientTypes] = await Promise.all([
    prisma.financialCategory.findMany(),
    prisma.expenseType.findMany(),
    prisma.paymentMethod.findMany(),
    prisma.clientType.findMany(),
  ]);
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id;
  const expenseTypeId = (name: string) => expenseTypes.find((t) => t.name === name)?.id;
  const paymentMethodId = (name?: string) => (name ? paymentMethods.find((m) => m.name === name)?.id : undefined);
  const clientTypeId = (name: string) => clientTypes.find((t) => t.name === name)?.id;

  // Departments are global (not per-entity), so upsert by name and reuse
  // across both entities rather than creating duplicates on the second pass.
  const departmentByName = new Map<string, string>();
  for (const [i, name] of DEPARTMENTS.entries()) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
    departmentByName.set(name, dept.id);
  }
  const departmentId = (name?: string) => (name ? departmentByName.get(name) : undefined);

  const vendorByName = new Map<string, string>();
  for (const name of vendorNames) {
    const vendor = await prisma.vendor.upsert({
      where: { entityId_name: { entityId: entity.id, name } },
      update: {},
      create: { entityId: entity.id, name, country: entityCode === "UAE" ? "United Arab Emirates" : "India" },
    });
    vendorByName.set(name, vendor.id);
  }

  // The base rows above describe one representative month. Replaying them
  // across the previous 5 months (with a per-month scale factor and a
  // deterministic settlement pattern) gives the dashboards real history, so
  // the cash-flow trend, period-over-period deltas and weekly buckets all
  // have something true to show instead of empty states.
  const MONTHS_BACK = 5;
  const SCALE = [0.72, 0.81, 0.95, 0.88, 1.06, 1.0]; // oldest -> current
  let outflowCount = 0;
  let inflowCount = 0;

  for (let back = MONTHS_BACK; back >= 0; back--) {
    const scale = SCALE[MONTHS_BACK - back];
    const isCurrentMonth = back === 0;

    for (const [i, row] of outflows.entries()) {
      const date = shiftMonths(row.date, -back);
      const amountDue = new Decimal(row.amountDue).mul(scale).toDecimalPlaces(2);
      // Past months settle almost fully; only the current month keeps the
      // original mix of PAID / PARTIAL / PENDING so the status charts vary.
      const amountPaid = isCurrentMonth
        ? new Decimal(row.amountPaid).mul(scale).toDecimalPlaces(2)
        : i % 7 === 0
          ? amountDue.mul(0.6).toDecimalPlaces(2)
          : amountDue;

      const txn = await prisma.financialTransaction.create({
        data: {
          entityId: entity.id,
          transactionType: "OUTFLOW",
          transactionDate: date,
          originalAmount: amountDue,
          originalCurrency: currency,
          categoryId: categoryId(row.category),
          expenseTypeId: expenseTypeId(row.expenseType),
          vendorId: row.vendor ? vendorByName.get(row.vendor) : undefined,
          departmentId: departmentId(row.department),
          description: row.description,
          paidAmount: amountPaid,
          status: calculateStatus(amountDue, amountPaid),
          createdById: admin.id,
        },
      });
      outflowCount++;
      if (amountPaid.gt(0)) {
        await prisma.payment.create({
          data: {
            transactionId: txn.id,
            amount: amountPaid,
            currency,
            paymentDate: date,
            paymentMethodId: paymentMethodId(row.paymentMethod),
            createdById: admin.id,
          },
        });
      }
    }

    for (const [i, row] of inflows.entries()) {
      const date = shiftMonths(row.date, -back);
      const client = await prisma.client.upsert({
        where: { entityId_name: { entityId: entity.id, name: row.clientName } },
        update: {},
        create: { entityId: entity.id, name: row.clientName, clientTypeId: clientTypeId(row.clientType) },
      });
      const dealValue = new Decimal(row.dealValue).mul(scale).toDecimalPlaces(2);
      const amountReceived = isCurrentMonth
        ? new Decimal(row.amountReceived).mul(scale).toDecimalPlaces(2)
        : i % 5 === 0
          ? dealValue.mul(0.5).toDecimalPlaces(2)
          : dealValue;

      const txn = await prisma.financialTransaction.create({
        data: {
          entityId: entity.id,
          transactionType: "INFLOW",
          transactionDate: date,
          originalAmount: dealValue,
          originalCurrency: currency,
          clientId: client.id,
          departmentId: departmentId(row.department),
          description: row.description,
          closedByName: row.closedBy,
          paidAmount: amountReceived,
          status: calculateStatus(dealValue, amountReceived),
          createdById: admin.id,
        },
      });
      inflowCount++;
      if (amountReceived.gt(0)) {
        await prisma.payment.create({
          data: {
            transactionId: txn.id,
            amount: amountReceived,
            currency,
            paymentDate: date,
            paymentMethodId: paymentMethodId(row.paymentMethod),
            createdById: admin.id,
          },
        });
      }
    }
  }

  console.log(`${entityCode}: seeded ${outflowCount} outflow + ${inflowCount} inflow across ${MONTHS_BACK + 1} months`);
}

// One test account per non-SUPER_ADMIN role, so every permission boundary
// (entity isolation, viewer read-only, admin-only master data/FX/users) can
// actually be clicked through in the UI instead of only unit-tested.
// All share the same known temporary password and force a change on first
// login, same as the real SUPER_ADMIN seed in prisma/seed.ts.
const TEST_USERS: { email: string; name: string; role: UserRole }[] = [
  { email: "finance.admin@oneviewfinance.local", name: "Test Finance Admin", role: "FINANCE_ADMIN" },
  { email: "uae.finance@oneviewfinance.local", name: "Test UAE Finance", role: "UAE_FINANCE_USER" },
  { email: "india.finance@oneviewfinance.local", name: "Test India Finance", role: "INDIA_FINANCE_USER" },
  { email: "viewer@oneviewfinance.local", name: "Test Management Viewer", role: "MANAGEMENT_VIEWER" },
];

async function seedTestUsers() {
  const passwordHash = await bcrypt.hash("TestUser@2026", 12);
  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, passwordHash, mustChangePassword: true },
    });
  }
  console.log(`Seeded ${TEST_USERS.length} per-role test users (password: TestUser@2026, forced change on first login).`);
}

async function main() {
  await seedEntity("UAE", "AED", UAE_OUTFLOW, UAE_INFLOW, UAE_VENDORS);
  await seedEntity("INDIA", "INR", INDIA_OUTFLOW, INDIA_INFLOW, INDIA_VENDORS);
  await seedTestUsers();
  console.log("Demo data seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
