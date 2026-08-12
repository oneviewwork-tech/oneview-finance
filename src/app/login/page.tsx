import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LoginForm } from "./login-form";

/**
 * Deliberately dark regardless of the app's light/dark setting — this is a
 * standalone branded entry point, not part of the themed product surface,
 * so its colours are literal rather than token-driven.
 */
export default async function LoginPage() {
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
        {/* Brand lockup — same pattern as ONEVIEW People: Haris&Co. │ workspace */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandLogo size="lg" className="text-white" />
          <span className="h-5 w-px bg-white/25" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
            Finance
          </span>
        </div>

        {/* Glass card */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <h1 className="text-[1.375rem] font-semibold tracking-tight text-white">Sign in</h1>
          <p className="mt-1.5 text-sm text-white/50">Continue to your ONEVIEW Finance workspace.</p>

          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          Internal system. Access is limited to authorized ONEVIEW Finance users.
        </p>
      </div>
    </div>
  );
}
