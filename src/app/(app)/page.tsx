import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sutoreido</h1>
        <p className="text-muted-foreground mt-2">
          Invoicing, quoting and project management.
        </p>
      </div>

      <div className="text-sm">
        <p className="text-muted-foreground">
          Phase 1 in progress. The back office is live at{' '}
          <Link href="/admin" className="text-foreground font-medium underline underline-offset-4">
            /admin
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
