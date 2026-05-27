# Atlas One — DPA Template (rascunho tecnico-comercial)

**AVISO:** Modelo para negociacao B2B. **Nao e aconselhamento juridico.**  
Revisar com advogado antes de assinar com clientes.

---

## 1. Partes

- **Controlador:** [NOME EMPRESA CLIENTE], CNPJ [___]
- **Operador:** [RAZAO SOCIAL ATLAS ONE], CNPJ [___]

---

## 2. Objeto

Tratamento de dados pessoais pelo Operador em nome do Controlador, via plataforma Atlas One (CRM, WhatsApp, inbox, automacoes), conforme instrucoes documentadas e LGPD (Lei 13.709/2018).

---

## 3. Categorias de dados e titulares

- **Titulares:** contatos comerciais, leads, clientes finais do Controlador
- **Dados:** identificacao, contato, mensagens, dados comerciais (ver PRIVACY.md)

---

## 4. Obrigacoes do Operador

1. Tratar dados apenas conforme instrucoes documentadas do Controlador
2. Garantir confidencialidade de pessoal autorizado
3. Implementar medidas de seguranca (SECURITY.md)
4. Auxiliar Controlador em direitos dos titulares (exportacao, exclusao via plataforma)
5. Notificar incidentes de seguranca em prazo acordado (sugestao: 72h uteis)
6. Subcontratar apenas com autorizacao e DPA equivalente
7. Ao termino: eliminar ou devolver dados conforme instrucao (prazo: [30] dias)

---

## 5. Subprocessadores (lista inicial)

| Subprocessador | Finalidade | Local |
|----------------|------------|-------|
| [Provedor cloud] | Hosting app + DB | [Regiao] |
| Evolution API / Meta | WhatsApp | [Regiao] |
| [SMS provider] | 2FA | [Regiao] |

Controlador autoriza lista e alteracoes com aviso previo de [30] dias.

---

## 6. Seguranca

Referencia: SECURITY.md, SECURITY_BASELINE.md, BACKUP_RESTORE.md.

Controles minimos: TLS, controle de acesso, auditoria, backup, isolamento multi-tenant.

---

## 7. Auditoria

Controlador pode solicitar evidencias anuais (questionario + amostra de logs). Pentest sob demanda conforme [PENTEST_SCOPE.md](./PENTEST_SCOPE.md).

---

## 8. Responsabilidade

Conforme legislacao aplicavel e contrato master de servicos (MSA). Limitacao de responsabilidade: [definir com juridico].

---

## 9. Prazo e vigencia

Vigente enquanto contrato SaaS ativo. Sobrevive ao termino por periodo necessario a eliminacao de dados.

---

## 10. Anexos tecnicos

- PRIVACY.md
- LGPD_CHECKLIST.md
- SECURITY.md
- SLA_TEMPLATE.md
- ENTERPRISE_READINESS.md

---

*Rascunho Phase 7 — substituir placeholders antes de uso comercial.*
