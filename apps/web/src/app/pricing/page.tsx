import type { Metadata } from "next";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Planos e precos",
  description: "Planos Atlas One para equipes comerciais com WhatsApp, CRM e operacao."
};

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 297/mes",
    seats: "ate 3 usuarios",
    channels: "1 canal WhatsApp",
    highlight: false
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 697/mes",
    seats: "ate 10 usuarios",
    channels: "2 canais WhatsApp",
    highlight: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    seats: "usuarios ilimitados",
    channels: "Multiplos canais + Meta Cloud",
    highlight: false
  }
];

export default function PricingPage() {
  return (
    <PublicPageShell
      title="Planos Atlas One"
      subtitle="WhatsApp, CRM, filas e supervisao comercial para equipes B2B. Onboarding assistido no primeiro cliente."
    >
      <div className="not-prose grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`rounded-2xl border p-6 shadow-sm ${
              plan.highlight
                ? "border-blue-500 bg-white/80 ring-2 ring-blue-500/30 dark:bg-slate-900/60"
                : "border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40"
            }`}
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{plan.name}</h2>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{plan.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>{plan.seats}</li>
              <li>{plan.channels}</li>
              <li>CRM + pipeline comercial</li>
              <li>Relatorios e exportacao CSV</li>
            </ul>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        Para contratar, entre em contato com a equipe Atlas One. O acesso ao produto e liberado apos configuracao da
        empresa e integracao WhatsApp.
      </p>
    </PublicPageShell>
  );
}
