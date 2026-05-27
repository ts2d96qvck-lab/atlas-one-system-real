import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PublicPageShell({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <header className="mx-auto mb-10 flex max-w-3xl flex-wrap items-center justify-between gap-4">
        <Link href="/landing" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Atlas One
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
          <Link href="/landing" className="hover:text-slate-900 dark:hover:text-white">
            Inicio
          </Link>
          <Link href="/apresentacao" className="hover:text-slate-900 dark:hover:text-white">
            Apresentacao
          </Link>
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Planos
          </Link>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">
            Termos
          </Link>
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">
            Privacidade
          </Link>
          <Link href="/status" className="hover:text-slate-900 dark:hover:text-white">
            Status
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Entrar
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {subtitle ? <p className="mb-8 text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
        <div className="prose prose-slate max-w-none dark:prose-invert">{children}</div>
      </main>
    </div>
  );
}
