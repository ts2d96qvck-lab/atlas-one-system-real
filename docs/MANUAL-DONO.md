# Manual do Dono — Atlas One

Guia completo para o proprietário da operação configurar, governar e escalar o Atlas One.

---

## 1. Primeiro acesso

### Link oficial
```
http://app.atlasone.local.gd
```

### Login
1. Informe o **ID da empresa** (ex.: `atlas-one`)
2. E-mail e senha da conta **dona**
3. Confirme o **código SMS** (2FA obrigatório para o dono)

> A conta dona é criada uma única vez. Colaboradores entram por **Solicitar acesso** e você aprova no Admin.

### Iniciar o sistema (Windows)
```powershell
.\start-enterprise.ps1
```

---

## 2. Configuração inicial (Dia 1)

### Checklist do dono

- [ ] Conectar WhatsApp comercial (Admin → Instâncias → QR Code)
- [ ] Sincronizar webhook (Admin → Sync webhook)
- [ ] Criar departamentos (Admin → Departamentos)
  - **Novos** — fila de clientes que entram em contato (obrigatório)
  - Comercial, Financeiro, Suporte — conforme sua operação
- [ ] Cadastrar atendentes com departamento vinculado
- [ ] Criar atalhos por hashtag (Admin → Atalhos)
- [ ] Testar envio e recebimento na Inbox
- [ ] Revisar funil CRM (etapas do pipeline)
- [ ] Configurar meta no Dashboard (se aplicável)

---

## 3. Gestão de equipe

### Perfis disponíveis

| Perfil | O que pode fazer |
|--------|------------------|
| **Dono (owner)** | Tudo + revenda multi-empresa + reset operacional |
| **Admin** | Usuários, departamentos, WhatsApp, auditoria |
| **Supervisor** | Monitorar equipe, Admin parcial, Dashboard |
| **Gerente** | Monitorar departamento, Dashboard |
| **Atendente (agent)** | Inbox + CRM do próprio atendimento |

### Criar atendente
1. Admin → **Usuários** → Novo usuário
2. Preencha nome, e-mail, senha, telefone
3. Selecione **perfil** e **departamento** (obrigatório para atendente/supervisor)
4. Salvar

### Aprovar solicitação de acesso
1. Colaborador clica em **Solicitar acesso** na tela de login
2. Admin → **Solicitações pendentes** → Aprovar
3. Atribua departamento se necessário (editar usuário)

### Monitorar operação
- **Inbox** → filtro por departamento → selecionar atendente
- Alertas **+5m** — cliente aguardando resposta há mais de 5 minutos
- **Dashboard** — volume, conversão, receita projetada

---

## 4. WhatsApp (Evolution API)

### Conectar número
1. Admin → **Instâncias WhatsApp**
2. Selecionar instância → **Conectar QR**
3. Escanear com o celular (WhatsApp → Aparelhos conectados)
4. Clicar **Sync webhook**

### Regras operacionais
- Todo cliente novo cai no departamento **Novos** com distribuição automática
- Ao **fechar** atendimento, conversa sai da fila do atendente
- Se o cliente responder depois, retorna para **Novos** mantendo histórico

### Problemas comuns
| Sintoma | Ação |
|---------|------|
| QR não aparece | Verificar Evolution API (Docker) e reconectar |
| Mensagem não envia | Admin → status da instância → reconectar |
| Webhook parado | Admin → Sync webhook |

---

## 5. Departamentos

### Por que usar
- Separar Comercial, Financeiro, Suporte, Novos
- Manager acompanha só o departamento dele
- Transferência organizada entre equipes

### Criar departamento
1. Admin → **Departamentos** → Nome → Criar
2. Ao criar usuário, vincule ao departamento

### Departamento "Novos"
Crie sempre um departamento chamado **Novos** (ou equivalente). Mensagens inbound de clientes desconhecidos são roteadas para lá automaticamente.

---

## 6. Atalhos por hashtag

Respostas rápidas padronizadas para a equipe.

**Exemplo:**
| Hashtag | Texto |
|---------|-------|
| `#boasvindas` | Olá! Sou da equipe Atlas One. Como posso ajudar? |
| `#horario` | Nosso horário de atendimento é de 9h às 18h. |

**Cadastro:** Admin → Atalhos por hashtag  
**Uso:** Inbox → selecionar hashtag ou digitar `#tag` no campo de mensagem

---

## 7. CRM e funil

- Cada conversa pode ter um **lead** vinculado
- Arraste cards no Kanban para mudar etapa
- Duplo clique no lead abre edição completa
- Automações disparam ao mudar etapa (Admin → Automações)

### Etapas padrão
Novos leads → Contato feito → Reunião marcada → Proposta enviada → Negociação → Fechado / Perdido

---

## 8. Automações

Gatilhos disponíveis:
- Lead criado / mudou etapa / fechado / perdido
- Conversa criada / sem atendente

Ações:
- Enviar mensagem WhatsApp com variáveis (`{{nome}}`, `{{empresa}}`, etc.)
- Condições: valor mínimo, horário comercial

Configure em **Automacao** (aba inferior).

---

## 9. Dashboard

Métricas para decisão comercial:
- Conversas abertas / fechadas
- Valor do pipeline
- Receita fechada vs meta
- Projeção com simulador (reuniões × taxa × ticket)

Acesso: perfis **dono, admin, supervisor, gerente**.

---

## 10. Segurança e governança

### Boas práticas
- Dono sempre com **2FA ativo**
- Senhas fortes (mín. 8 caracteres)
- Revise **Monitor de acessos** semanalmente
- Não compartilhe login entre pessoas
- Cada atendente com conta individual

### Auditoria
Admin → **Monitor de acessos** registra:
- Criação/alteração de usuários
- Atalhos criados/removidos
- Ações administrativas

### Bloqueio de tenant
Em caso de inadimplência (revenda), billing pode bloquear login — contate suporte técnico.

---

## 11. Revenda multi-empresa (SaaS)

Se você revende o Atlas One para outras empresas:

1. Admin → **Onboarding de empresa**
2. Informe nome, slug (ID), CNPJ opcional
3. Cliente cria conta dona no slug dele
4. Cada tenant é isolado (dados, usuários, WhatsApp)

---

## 12. Tema claro / escuro

Botão **Noturno / Claro** no canto inferior esquerdo. Preferência salva automaticamente.

---

## 13. Manutenção

| Tarefa | Frequência |
|--------|------------|
| Verificar WhatsApp conectado | Diário |
| Revisar fila +5m | Diário |
| Backup banco PostgreSQL | Diário (produção) |
| Revisar auditoria | Semanal |
| Atualizar atalhos e automações | Conforme operação |

### Reiniciar sistema
```powershell
.\start-enterprise.ps1
```

---

## 14. Contatos e escalonamento

| Nível | Responsável | Quando acionar |
|-------|-------------|----------------|
| N1 | Supervisor | Dúvida operacional, transferência |
| N2 | Admin técnico | WhatsApp desconectado, erro de envio |
| N3 | Dono / Dev | Indisponibilidade total, banco, infra |

---

*Documento: Manual do Dono v1.0 — Atlas One*
