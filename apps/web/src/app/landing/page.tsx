import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "../../components/public-page-shell";
import { ProductShowcase } from "../../components/product-showcase";

export const metadata: Metadata = {
  title: "Atlas One — WhatsApp, CRM e operacao comercial",
  description: "Plataforma B2B para equipes comerciais: WhatsApp, inbox, CRM, filas e supervisao."
};

const MODULES = [
  {
    title: "Inbox WhatsApp",
    body: "Varios atendentes no mesmo numero. Filas, transferencia e historico unificado.",
    variant: "inbox" as const
  },
  {
    title: "CRM Kanban",
    body: "Funil visual com leads vinculados as conversas. Arraste etapas e acompanhe receita.",
    variant: "crm" as const
  },
  {
    title: "Dashboard",
    body: "Metricas de resposta, conversao e carga por atendente em tempo real.",
    variant: "dashboard" as const
  },
  {
    title: "Admin + API",
    body: "Departamentos, usuarios, chaves API e webhooks em um painel so.",
    variant: "admin" as const
  }
];

export default function LandingPage() {
  return (
    <PublicPageShell
      title="Operacao comercial premium no WhatsApp"
      subtitle="Um numero, varios atendentes, CRM integrado e supervisao — sem planilha, sem caos no celular pessoal."
    >
      <div className="not-prose mb-8 flex flex-wrap gap-3">
        <Link
          href="/apresentacao"
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ver apresentacao (PDF)
        </Link>
        <Link
          href="/pricing"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Ver planos
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-white/60 dark:border-slate-600 dark:text-slate-100"
        >
          Entrar na plataforma
        </Link>
      </div>

      <div className="not-prose mb-10 grid gap-6 sm:grid-cols-2">
        {MODULES.map((m) => (
          <div key={m.title}>
            <ProductShowcase title={m.title} variant={m.variant} />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="not-prose rounded-2xl border border-blue-200 bg-blue-50/80 p-5 dark:border-blue-900 dark:bg-blue-950/40">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Para quem e?</p>
        <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>Equipes comerciais B2B com WhatsApp como canal principal</li>
          <li>Empresas com 3 a 30 atendentes que precisam de controle e CRM</li>
          <li>Revendedores SaaS que implantam multi-empresa (multi-tenant)</li>
        </ul>
      </div>

      <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/apresentacao" className="underline">
          Baixar apresentacao em PDF
        </Link>
        {" · "}
        <Link href="/terms" className="underline">
          Termos
        </Link>
        {" · "}
        <Link href="/privacy" className="underline">
          Privacidade
        </Link>
      </p>
    </PublicPageShell>
  );
}
