import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Master data below is taken verbatim from the "Lists" sheet of
// Dubai_August_2026_Live_Finance_Tracker.xlsx — these are the exact
// dropdown values the accounts team already uses, now DB-backed and
// editable instead of "add a row to the Lists sheet".

const CATEGORIES = [
  "Salaries & Allowances",
  "Rent & Utilities",
  "Telecom & Internet",
  "Travel & Meeting",
  "Equipment",
  "Freelancers & Production",
  "Marketing & Advertising",
  "Software & Subscriptions",
  "Visa & Government Fees",
  "Bank & Salary Charges",
  "Incentives & Commissions",
  "Office & Misc",
  "Old Dues / Arrears",
];

const EXPENSE_TYPES = ["Current Month", "Old Dues / Arrears"];

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Cheque",
  "Card",
  "Online",
  "WPS",
  "Auto-Debit",
];

const CLIENT_TYPES = [
  "New Client",
  "Existing Client",
  "Renewal",
  "Upsell",
  "One-Time Project",
];

async function main() {
  await Promise.all(
    CATEGORIES.map((name, i) =>
      prisma.financialCategory.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      })
    )
  );

  await Promise.all(
    EXPENSE_TYPES.map((name, i) =>
      prisma.expenseType.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      })
    )
  );

  await Promise.all(
    PAYMENT_METHODS.map((name, i) =>
      prisma.paymentMethod.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      })
    )
  );

  await Promise.all(
    CLIENT_TYPES.map((name, i) =>
      prisma.clientType.upsert({
        where: { name },
        update: { sortOrder: i },
        create: { name, sortOrder: i },
      })
    )
  );

  await prisma.businessEntity.upsert({
    where: { code: "UAE" },
    update: {},
    create: {
      code: "UAE",
      name: "UAE",
      country: "United Arab Emirates",
      baseCurrency: "AED",
    },
  });

  await prisma.businessEntity.upsert({
    where: { code: "INDIA" },
    update: {},
    create: {
      code: "INDIA",
      name: "India",
      country: "India",
      baseCurrency: "INR",
    },
  });

  const passwordHash = await bcrypt.hash("SuperAdmin@2026", 10);
  await prisma.user.upsert({
    where: { email: "admin@oneviewfinance.local" },
    update: {},
    create: {
      email: "admin@oneviewfinance.local",
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      mustChangePassword: true,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
