import type { Metadata } from "next";
import { PublicPageShell } from "../../components/public-page-shell";

export const metadata: Metadata = {
  title: "Politica de privacidade",
  description: "Politica de privacidade do Atlas One."
};

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Politica de privacidade"
      subtitle="Resumo operacional. Documento completo e DPA devem ser revisados juridicamente para clientes enterprise."
    >
      <section>
        <h2>Dados tratados</h2>
        <p>
          Coletamos dados de cadastro (nome, e-mail, telefone), dados operacionais (conversas, leads, logs de
          auditoria) e metadados tecnicos (IP, user-agent) para seguranca e suporte.
        </p>
      </section>
      <section>
        <h2>Finalidade</h2>
        <p>
          Os dados sao usados para prestar o servico, autenticacao, cobranca, integracao WhatsApp, relatorios e
          cumprimento de obrigacoes legais.
        </p>
      </section>
      <section>
        <h2>Compartilhamento</h2>
        <p>
          Podemos compartilhar dados com provedores essenciais (hospedagem, pagamento, WhatsApp/Evolution/Meta) apenas
          na medida necessaria para operacao contratada.
        </p>
      </section>
      <section>
        <h2>Retencao e seguranca</h2>
        <p>
          Aplicamos controles de acesso por tenant, criptografia em transito (HTTPS) e politicas de backup conforme
          documentacao operacional. Prazos de retencao seguem contrato e solicitacoes do titular quando aplicavel.
        </p>
      </section>
      <section>
        <h2>Direitos do titular</h2>
        <p>
          Titulares podem solicitar acesso, correcao ou exclusao conforme LGPD pelo canal de privacidade indicado no
          contrato comercial.
        </p>
      </section>
    </PublicPageShell>
  );
}
