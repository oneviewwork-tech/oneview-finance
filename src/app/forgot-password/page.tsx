import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ForgotPasswordPanel } from "./forgot-password-panel";

/**
 * The login password's forgot-flow — separate from /passkey's, which resets
 * the second factor for someone who is already signed in. This one has to
 * work with no session at all, which is the whole reason it exists.
 *
 * Same dark standalone shell as /login: this is the entry surface, not the
 * themed product UI, so colours are literal rather than token-driven.
 */
export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/");

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
          <ForgotPasswordPanel />
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Internal system. Access is limited to authorized ONEVIEW Finance users.
        </p>
      </div>
    </div>
  );
}
