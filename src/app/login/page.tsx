import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            <Image src="/logo-haris.jpg" alt="Haris & Co." width={48} height={48} className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">ONEVIEW Finance</h1>
            <p className="mt-1 text-sm text-muted-foreground">Accounts and Finance View access</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        <p className="text-center text-metadata">
          Internal system. Access is limited to authorized ONEVIEW Finance users.
        </p>
      </div>
    </div>
  );
}
