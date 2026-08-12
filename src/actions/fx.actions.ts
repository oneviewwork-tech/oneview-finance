"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { parseDateOnly } from "@/lib/date";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { setManualRateSchema } from "@/validators/fx";
import { refreshLiveRates, setManualRate } from "@/services/fx/exchange-rate.service";

export async function setManualExchangeRate(formData: FormData): Promise<ActionResult> {
  const parsed = setManualRateSchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
    quoteCurrency: formData.get("quoteCurrency"),
    rate: formData.get("rate"),
    rateDate: formData.get("rateDate"),
  });
  if (!parsed.success) return actionError("Invalid input", zodFieldErrors(parsed.error));
  if (parsed.data.baseCurrency === parsed.data.quoteCurrency) {
    return actionError("Base and quote currency must be different", {
      quoteCurrency: ["Base and quote currency must be different"],
    });
  }

  const actor = await getCurrentUser();
  await setManualRate({
    baseCurrency: parsed.data.baseCurrency,
    quoteCurrency: parsed.data.quoteCurrency,
    rate: new Prisma.Decimal(parsed.data.rate),
    rateDate: parseDateOnly(parsed.data.rateDate),
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidatePath("/intelligence");
  revalidatePath("/intelligence/fx");
  return actionSuccess(undefined);
}

export async function refreshLiveExchangeRate(): Promise<ActionResult> {
  try {
    await refreshLiveRates();
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Failed to refresh the live exchange rate");
  }
  revalidatePath("/intelligence");
  revalidatePath("/intelligence/fx");
  return actionSuccess(undefined);
}
