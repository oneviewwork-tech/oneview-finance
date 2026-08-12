import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">ONEVIEW Finance</h1>
        <p className="mt-2 text-muted-foreground">Accounts for entering data, Finance View for management.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/intelligence"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Open Finance View
          </Link>
          <Link
            href="/operations"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
          >
            Open Accounts
          </Link>
        </div>
      </div>
    </main>
  );
}
