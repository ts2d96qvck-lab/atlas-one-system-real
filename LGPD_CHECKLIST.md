# Atlas One — LGPD Checklist (tecnico)

Checklist para due diligence de privacidade. Marque com evidencia (doc, screenshot, endpoint).

---

## Controlador vs Operador

- [ ] Contrato SaaS + DPA assinado (DPA_TEMPLATE.md)
- [ ] Cliente (controlador) informa titulares sobre tratamento via WhatsApp/CRM
- [ ] Canal do titular definido pelo cliente

---

## Bases e finalidades

- [ ] Finalidade documentada por modulo (CRM, inbox, automacao)
- [ ] Sem uso secundario de dados sem base legal
- [ ] Minimizacao: campos customizados revisados

---

## Direitos dos titulares

- [ ] Exportacao CSV disponivel (Dashboard / API)
- [ ] Exclusao de leads/conversas disponivel
- [ ] Processo interno do cliente para atender solicitacoes em prazo legal

---

## Seguranca (Art. 46)

- [ ] HTTPS em producao
- [ ] Controle de acesso RBAC
- [ ] Auditoria de acoes sensiveis (Monitor de acessos)
- [ ] Backup e restore testados (BACKUP_RESTORE.md)
- [ ] Segredos fora do git (SECURITY_BASELINE.md)
- [ ] 2FA para owner em producao

---

## Incidentes

- [ ] Procedimento de resposta documentado (SECURITY.md sec. 6)
- [ ] Contato para notificacao ANPD/controlador definido
- [ ] Registro de incidentes (template interno)

---

## Subprocessadores

- [ ] Lista atualizada no DPA
- [ ] WhatsApp provider documentado (WHATSAPP_PROVIDERS.md)
- [ ] Regiao de dados conhecida pelo cliente

---

## Retencao

- [ ] Politica de retencao definida com cliente
- [ ] Audit logs — periodo acordado
- [ ] Exclusao pos-cancelamento documentada

---

## Transferencia internacional

- [ ] Regiao de hosting informada no contrato
- [ ] Clausulas contratuais se aplicavel (juridico)

---

## Evidencias no produto

| Requisito | Onde verificar |
|-----------|----------------|
| Exportacao | Dashboard → CSV ou GET /v1/export/* |
| Auditoria | Admin → Monitor de acessos |
| Permissoes | Admin → Usuarios |
| API keys revogaveis | Admin → Integracoes |
| Logout auditado | POST /auth/logout |

---

*Checklist tecnico Phase 7 — complementar avaliacao juridica.*
