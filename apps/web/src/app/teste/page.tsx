import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teste o Atlas One",
  description: "Crie sua conta de teste ou solicite acesso a equipe comercial."
};

export default function TestePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Atlas One · Demonstracao</p>
        <h1 className="mt-3 text-4xl font-semibold">Teste o sistema no conforto do seu computador</h1>
        <p className="mt-4 text-lg text-slate-300">
          Envie este link para clientes, parceiros ou membros da equipe. Eles criam a conta e voce aprova no Admin antes de liberar o
          acesso completo.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/?auth=equipe"
            className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur transition hover:bg-white/15"
          >
            <p className="text-sm font-semibold text-cyan-200">Sou da equipe</p>
            <p className="mt-2 text-sm text-slate-300">Solicitar acesso a uma empresa ja cadastrada. O administrador aprova em Admin → Aprovacao.</p>
            <p className="mt-4 text-xs font-medium text-white">Entrar como equipe →</p>
          </Link>

          <Link
            href="/?auth=register"
            className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur transition hover:bg-white/15"
          >
            <p className="text-sm font-semibold text-emerald-200">Quero criar minha empresa</p>
            <p className="mt-2 text-sm text-slate-300">Cadastro inicial para donos de negocio que vao operar inbox, CRM, WhatsApp e dashboard.</p>
            <p className="mt-4 text-xs font-medium text-white">Criar conta →</p>
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
          <p className="font-semibold text-white">Como funciona na pratica</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>A pessoa abre o link, preenche nome, e-mail e senha.</li>
            <li>Voce recebe a solicitacao em Admin → Aprovacao (equipe) ou a conta ja entra ativa (dono).</li>
            <li>Depois de aprovada, ela usa Inbox, CRM, Dashboard e Automacoes conforme o perfil.</li>
          </ol>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          Ja tem conta? <Link href="/" className="text-cyan-300 underline">Fazer login</Link>
        </p>
      </div>
    </main>
  );
}
