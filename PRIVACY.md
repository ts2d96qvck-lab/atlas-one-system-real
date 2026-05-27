# Atlas One — Privacy (estrutura tecnica)

**Rascunho tecnico para apoio a politica de privacidade.**  
Requer revisao juridica antes de publicacao comercial.

---

## 1. Papel das partes

| Papel LGPD | Quem |
|------------|------|
| Controlador | Cliente B2B (empresa assinante) |
| Operador | Atlas One (plataforma SaaS) |
| Titulares | Contatos/leads atendidos via WhatsApp e CRM |

O cliente define finalidade do tratamento (vendas, suporte). Atlas One processa dados conforme instrucoes do cliente e contrato (DPA).

---

## 2. Dados tratados

| Categoria | Exemplos | Finalidade |
|-----------|----------|------------|
| Identificacao | Nome, e-mail, telefone | CRM, atendimento |
| Comunicacao | Mensagens WhatsApp, midia | Inbox multi-agente |
| Comercial | Status lead, valor, pipeline | Vendas |
| Tecnicos | IP login, user-agent, audit logs | Seguranca |
| Operacionais | Config empresa, SLA, webhooks | Servico |

**Nao coletamos** dados sensiveis (saude, biometria) por padrao. Cliente deve evitar enviar via WhatsApp se nao necessario.

---

## 3. Bases legais (orientacao)

| Tratamento | Base sugerida |
|------------|---------------|
| Execucao do contrato SaaS | Art. 7 V LGPD |
| Atendimento ao titular (cliente final) | Legitimo interesse / relacao comercial do controlador |
| Seguranca e auditoria | Legitimo interesse / obrigacao |
| Marketing pelo cliente | Responsabilidade do controlador |

---

## 4. Compartilhamento

| Destinatario | Motivo |
|--------------|--------|
| Evolution API / Meta Cloud | Entrega WhatsApp |
| Provedor SMS (Twilio etc.) | 2FA |
| Webhooks configurados pelo cliente | Integracao |
| Infra (hosting, Postgres) | Operacao |

Subprocessadores devem constar no DPA. Cliente pode configurar regiao de hosting conforme contrato enterprise.

---

## 5. Retencao e exclusao

| Acao | Como |
|------|------|
| Exportar dados | Dashboard CSV ou API `/v1/export/*` |
| Excluir conversa/lead | Inbox / CRM (auditado) |
| Excluir conta tenant | Contato comercial / owner reset |
| Retencao audit logs | Configuravel — recomendado 12-24 meses |

Direitos do titular (acesso, correcao, exclusao) devem ser atendidos pelo **controlador** (cliente), com suporte do operador via exportacao/exclusao.

---

## 6. Seguranca

Ver [SECURITY.md](./SECURITY.md): criptografia em transito (TLS), senhas com bcrypt, isolamento multi-tenant, 2FA, auditoria.

---

## 7. Transferencia internacional

Se infra ou subprocessadores estiverem fora do Brasil, documentar no DPA e DPIA do cliente. Cloudflare / AWS / GCP — ver regiao escolhida no deploy.

---

## 8. Contato (preencher)

| Campo | Valor |
|-------|-------|
| Encarregado (DPO) | _A definir pelo controlador_ |
| Privacidade Atlas One | privacy@atlasone.com.br _(exemplo)_ |
| Canal titulares | Definido pelo cliente assinante |

---

*Estrutura tecnica — Phase 7. Revisao juridica obrigatoria.*
