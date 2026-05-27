import type { Metadata } from "next";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Termos de uso do Atlas One."
};

export default function TermsPage() {
  return (
    <PublicPageShell title="Termos de uso" subtitle="Versao resumida para operacao comercial. Revise com assessoria juridica antes de producao em escala.">
      <section>
        <h2>1. Servico</h2>
        <p>
          O Atlas One e uma plataforma SaaS B2B para atendimento comercial via WhatsApp, CRM e operacao de equipes. O
          acesso e concedido mediante contrato, assinatura ou acordo comercial.
        </p>
      </section>
      <section>
        <h2>2. Conta e responsabilidades</h2>
        <p>
          O cliente e responsavel pelos usuarios convidados, credenciais, conteudo das conversas e conformidade com a
          legislacao aplicavel, incluindo LGPD e politicas do WhatsApp/Meta.
        </p>
      </section>
      <section>
        <h2>3. Pagamento e suspensao</h2>
        <p>
          Planos sao cobrados conforme contratacao. Contas inadimplentes podem ter acesso limitado ou suspenso apos
          aviso conforme politica comercial vigente.
        </p>
      </section>
      <section>
        <h2>4. Disponibilidade</h2>
        <p>
          Empregamos esforcos comerciais razoaveis para manter o servico disponivel. Manutencoes programadas podem
          ocorrer; status publico em <a href="/status">/status</a>.
        </p>
      </section>
      <section>
        <h2>5. Contato</h2>
        <p>Para duvidas sobre estes termos, utilize o canal comercial informado no contrato ou onboarding.</p>
      </section>
    </PublicPageShell>
  );
}
