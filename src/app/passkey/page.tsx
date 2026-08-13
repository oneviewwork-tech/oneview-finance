import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PasskeyPanel } from "./passkey-panel";

/**
 * The second-factor gate. Same standalone dark surface as /login — it sits
 * between signing in and reaching the app, so it belongs to the entry
 * experience rather than the themed product UI.
 */
export default async function PasskeyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passkeyHash: true, email: true },
  });
  if (!user) redirect("/login");

  const hasPasskey = !!user.passkeyHash;

  // Only allow relative destinations. An open redirect here would let a
  // crafted link bounce an authenticated admin to an attacker's page
  // immediately after they prove their second factor.
  const raw = params.next ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  // Masked so the page confirms which inbox to check without printing the
  // full address on a shared screen.
  const maskedEmail = maskEmail(user.email);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        backgroundImage: [
          "radial-gradient(ellipse 95% 55% at 50% 118%, #7cb2ff 0%, #3b82f6 16%, #1d4ed8 34%, #172554 52%, transparent 72%)",
          "linear-gradient(180deg, #04050a 0%, #05070f 45%, #070c1a 100%)",
        ].join(", "),
      }}
    >
      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandLogo size="lg" className="text-white" />
          <span className="h-5 w-px bg-white/25" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
            Finance
          </span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <PasskeyPanel
            hasPasskey={hasPasskey}
            next={next}
            maskedEmail={maskedEmail}
            startInReset={params.mode === "reset"}
          />
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          This extra step protects financial data. It is asked once per sign-in.
        </p>
      </div>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
