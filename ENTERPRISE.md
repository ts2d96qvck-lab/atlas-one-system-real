# Atlas One — Enterprise

## Link oficial (unico)

```txt
http://app.atlasone.local.gd
```

## Subir tudo com um comando

```powershell
.\start-enterprise.ps1
```

## Subir manualmente (Windows / PowerShell)

```powershell
docker compose -f docker-compose.local-domain.yml up -d
docker compose -f docker-compose.atlas-db.yml up -d

cd apps\server
npx pnpm db:push
npx pnpm dev

cd ..\web
npx pnpm dev
```

Abrir: **http://app.atlasone.local.gd**

## Acesso em outro notebook/celular na mesma rede

1. Descobrir o IP da maquina que roda API/Web (`ipconfig`).
2. Garantir firewall liberando portas `80`, `3001` e `4000`.
3. No cliente, usar o link oficial se o DNS local resolver, ou `http://SEU_IP` com proxy ativo.

## Login

Use a conta dona da operacao. Colaboradores entram por **Solicitar acesso** e sao aprovados no Admin.

## Modulos principais

- `Inbox`: chat real, status de mensagem, resposta direcionada, reacoes, midias, transferencia, notificacoes de fila.
- `Admin`: usuarios, departamentos, WhatsApp (QR/webhook), monitor de acessos, atalhos por hashtag.
- `CRM`: funil kanban, edicao de lead, valor, responsavel e previsao.
- `Automacao`: gatilhos por lead/conversa com condicoes operacionais.

## Atalhos por hashtag (resposta rapida)

1. Abrir `Admin` > **Atalhos por hashtag**.
2. Cadastrar `#tag` e texto.
3. No `Inbox`, selecionar a hashtag e clicar em **Aplicar no texto**.
4. Se digitar apenas `#tag` e enviar, o sistema substitui automaticamente pelo texto do atalho.

## WhatsApp (Evolution)

1. `Admin` > selecionar numero > **Conectar QR**.
2. Escanear no WhatsApp do celular.
3. Executar **Sync webhook**.
4. Testar envio/recebimento na `Inbox`.

Webhook publico local:

- `WEBHOOK_PUBLIC_URL=http://app.atlasone.local.gd`
