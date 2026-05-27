# FAQ e Suporte — Atlas One

---

## Acesso e login

**P: Qual o link do sistema?**  
R: http://app.atlasone.local.gd (ambiente local). Em produção, use o domínio configurado com HTTPS.

**P: O que é "ID da empresa"?**  
R: Identificador único do tenant (ex.: `atlas-one`). Definido na criação da conta dona.

**P: Esqueci minha senha.**  
R: Tela de login → **Esqueci minha senha** → código SMS → nova senha.

**P: Por que pede SMS no login?**  
R: Autenticação em duas etapas (2FA). Obrigatória para conta dona; opcional para outros perfis.

**P: "Conta bloqueada" ao logar.****  
R: Tenant com billing bloqueado. Contate o administrador da plataforma.

---

## WhatsApp

**P: Mensagem não envia — erro Evolution 400.**  
R: Verifique instância conectada (Admin), número normalizado com DDI 55, reconecte QR se necessário.

**P: Cliente respondeu e abriu conversa duplicada.**  
R: Não deve ocorrer — mensagens inbound reutilizam a mesma conversa. Se persistir, reporte com número e horário.

**P: Foto do cliente não aparece.**  
R: Alguns contatos não expõem foto via API. Sistema tenta sincronizar automaticamente; avatar com iniciais é fallback.

**P: Webhook parou de receber.**  
R: Admin → Sync webhook. Verifique Evolution API e `WEBHOOK_PUBLIC_URL`.

---

## Inbox e operação

**P: Conversa não aparece para o atendente.**  
R: Verifique se está atribuída a ele ou se filtro de departamento está correto.

**P: Como transferir atendimento?**  
R: Topo da conversa → selecionar atendente → Transferir. Some da fila de quem transferiu.

**P: Cliente fechou e voltou a mandar mensagem.**  
R: Retorna ao departamento **Novos** com histórico preservado.

**P: Enter envia em vez de quebrar linha.**  
R: Use **Shift + Enter** para nova linha. Enter envia.

---

## Admin e equipe

**P: Colaborador solicitou acesso — o que faço?**  
R: Admin → Solicitações → Aprovar → vincular departamento.

**P: Atendente não vê Inbox/CRM.**  
R: Verifique permissões e departamento no cadastro do usuário.

**P: Como criar departamento Novos?**  
R: Admin → Departamentos → criar "Novos". Inbound roteia automaticamente.

---

## Tema e interface

**P: Modo escuro/claro com bug.**  
R: Botão canto inferior esquerdo. Se persistir: Ctrl+Shift+R para limpar cache.

**P: "Inseguro" no Chrome.**  
R: Normal em HTTP local. Em produção com HTTPS desaparece.

**P: Ícone da aba é globo.**  
R: Ctrl+Shift+R. Favicon está em `/favicon.svg`.

---

## Técnico

**P: Sistema não abre.**  
R: Execute `.\start-enterprise.ps1`. Verifique Docker Desktop ativo.

**P: API offline.**  
R: http://app.atlasone.local.gd/health — se falhar, reinicie com start-enterprise.

**P: Banco de dados.**  
R: Docker `docker-compose.atlas-db.yml`. PostgreSQL porta 5432.

**P: Evolution API.**  
R: Docker `docker-compose.evolution.yml`. Porta 8080.

---

## Comercial / revenda

**P: Posso revender para várias empresas?**  
R: Sim. Admin → Onboarding de empresa. Cada tenant isolado.

**P: Onde está a documentação completa?**  
R: docs/INDICE-DOCUMENTACAO.md

---

*FAQ v1.0 — Atlas One*
