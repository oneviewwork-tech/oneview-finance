import { prisma } from "@/lib/prisma";
import { requireMasterDataAccess } from "@/lib/rbac";
import {
  createCategory,
  createClientType,
  createDepartment,
  createExpenseType,
  createPaymentMethod,
  setCategoryActive,
  setClientTypeActive,
  setDepartmentActive,
  setExpenseTypeActive,
  setPaymentMethodActive,
} from "@/actions/master-data.actions";
import { MasterDataSection } from "./master-data-section";

export default async function MasterDataPage() {
  await requireMasterDataAccess();
  const [categories, expenseTypes, paymentMethods, clientTypes, departments] = await Promise.all([
    prisma.financialCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.expenseType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.clientType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-page-title">Master Data</h1>
      <p className="mt-1 text-page-subtitle">
        Shared across UAE and India. Deactivate an item instead of
        deleting it if it&rsquo;s already used on past transactions.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <MasterDataSection
          title="Categories"
          description="Expense categories used on the Outflow form."
          items={categories}
          createAction={createCategory}
          toggleAction={setCategoryActive}
        />
        <MasterDataSection
          title="Expense Types"
          description="Current Month vs Old Dues / Arrears, used on the Outflow form."
          items={expenseTypes}
          createAction={createExpenseType}
          toggleAction={setExpenseTypeActive}
        />
        <MasterDataSection
          title="Payment Methods"
          description="Bank Transfer, Cash, Cheque and other modes used when recording a payment."
          items={paymentMethods}
          createAction={createPaymentMethod}
          toggleAction={setPaymentMethodActive}
        />
        <MasterDataSection
          title="Client Types"
          description="New Client, Existing Client, Renewal and other types used on the Clients form."
          items={clientTypes}
          createAction={createClientType}
          toggleAction={setClientTypeActive}
        />
        <MasterDataSection
          title="Departments"
          description="Optional tag on the Outflow form, used for the per-department payment status view on Finance View."
          items={departments}
          createAction={createDepartment}
          toggleAction={setDepartmentActive}
        />
      </div>
    </div>
  );
}
