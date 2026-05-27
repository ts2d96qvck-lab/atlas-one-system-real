"use client";

import Link from "next/link";
import { ProductShowcase } from "../../components/product-showcase";
import "../apresentacao/apresentacao.css";

export function ApresentacaoClient() {
  return (
    <div className="apresentacao-doc mx-auto max-w-4xl bg-white px-6 py-10 text-slate-900 print:px-0 print:py-0">
      <header className="mb-10 border-b border-slate-200 pb-8 print:break-after-page">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Atlas One</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">WhatsApp + CRM + Supervisao comercial</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Plataforma SaaS B2B para equipes que atendem pelo WhatsApp e precisam escalar sem perder leads.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Salvar como PDF (Ctrl+P)
          </button>
          <Link href="/landing" className="rounded-lg border px-4 py-2 font-semibold">
            Voltar ao site
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400 no-print">
          No navegador: Ctrl+P → Destino &quot;Salvar como PDF&quot; → Margens &quot;Minima&quot;
        </p>
      </header>

      <section className="mb-10 print:break-inside-avoid">
        <h2 className="text-2xl font-bold">O problema</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
          <li>Atendimento espalhado em celulares pessoais</li>
          <li>Leads perdidos no WhatsApp sem CRM</li>
          <li>Gestor sem visao de quem respondeu e quanto demorou</li>
          <li>Impossivel escalar equipe com um unico numero</li>
        </ul>
      </section>

      <section className="mb-10 print:break-inside-avoid">
        <h2 className="text-2xl font-bold">A solucao Atlas One</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <ProductShowcase title="Inbox multi-atendente" variant="inbox" />
          <ProductShowcase title="CRM Kanban" variant="crm" />
          <ProductShowcase title="Dashboard executivo" variant="dashboard" />
          <ProductShowcase title="Admin e API" variant="admin" />
        </div>
      </section>

      <section className="mb-10 print:break-after-page">
        <h2 className="text-2xl font-bold">Modulos incluidos</h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3 text-left">Modulo</th>
              <th className="p-3 text-left">Beneficio</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Inbox", "Chat WhatsApp profissional, filas, transferencia"],
              ["CRM", "Funil Kanban, leads, valor e etapas"],
              ["Dashboard", "SLA, conversao, carga por atendente"],
              ["Admin", "Usuarios, departamentos, WhatsApp, auditoria"],
              ["Automacoes", "Mensagens por gatilho (lead, conversa)"],
              ["API + Webhooks", "Integracao com ERP, Zapier, sistemas proprios"]
            ].map(([mod, ben]) => (
              <tr key={mod} className="border-b">
                <td className="p-3 font-semibold">{mod}</td>
                <td className="p-3 text-slate-600">{ben}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold">Planos (referencia)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { name: "Starter", price: "R$ 297/mes", detail: "Ate 5 usuarios · 1 WhatsApp" },
            { name: "Pro", price: "R$ 897/mes", detail: "Ate 25 usuarios · API + automacoes" },
            { name: "Enterprise", price: "Sob consulta", detail: "Escala + SSO + suporte dedicado" }
          ].map((p) => (
            <div key={p.name} className="rounded-xl border p-4">
              <p className="font-bold">{p.name}</p>
              <p className="mt-1 text-xl font-semibold text-blue-700">{p.price}</p>
              <p className="mt-2 text-xs text-slate-500">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold">Implantacao (3 dias)</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
          <li>Dia 1 — Conectar WhatsApp, departamentos, usuarios</li>
          <li>Dia 2 — Treinamento dono + equipe (2h)</li>
          <li>Dia 3 — Go-live com monitoramento assistido</li>
        </ol>
      </section>

      <section className="rounded-2xl bg-slate-900 p-8 text-white print:break-inside-avoid">
        <h2 className="text-2xl font-bold">Proximo passo</h2>
        <p className="mt-3 text-slate-300">
          Agende uma demonstracao ao vivo com sua operacao. Implantacao assistida no primeiro cliente.
        </p>
        <p className="mt-6 text-sm text-slate-400">Site: /landing · Planos: /pricing · Status: /status</p>
      </section>
    </div>
  );
}
