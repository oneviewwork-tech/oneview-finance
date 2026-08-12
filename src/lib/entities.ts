import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// URL-friendly slugs map to BusinessEntity.code ("UAE" | "INDIA"). Kept as
// an explicit small map rather than a lowercase() transform so a future
// third entity with an unusual code doesn't silently break routing.
const SLUG_TO_CODE: Record<string, string> = {
  uae: "UAE",
  india: "INDIA",
};

export async function requireEntityBySlug(slug: string) {
  const code = SLUG_TO_CODE[slug];
  if (!code) notFound();
  const entity = await prisma.businessEntity.findUnique({ where: { code } });
  if (!entity) notFound();
  return entity;
}

export function entitySlug(code: string): string {
  return code === "UAE" ? "uae" : "india";
}
