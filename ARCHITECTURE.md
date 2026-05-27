# Atlas One - Arquitetura Real

## Estado atual

O Atlas One roda como uma aplicação local Node.js:

- `server.js`: API HTTP, Socket.IO, integração Evolution API e persistência local.
- `public/`: frontend premium atual, preservado.
- `data/db.json`: banco local de desenvolvimento.
- `docker-compose.evolution.yml`: stack opcional para Evolution API local.

## Caminho para SaaS real

A arquitetura de produção deve evoluir para:

- Frontend web separado ou servido pelo backend.
- Backend Node.js modular com rotas, serviços e repositórios.
- Banco PostgreSQL para empresas, usuários, permissões, instâncias, conversas, mensagens, leads e auditoria.
- Redis/fila para webhooks de WhatsApp, retries e jobs de sincronização.
- Evolution API como gateway de WhatsApp por instância.
- Storage para mídia recebida/enviada.
- Autenticação JWT/session segura, senha com hash e permissões por usuário.

## Integração Evolution API

Fluxos previstos:

1. Admin cria uma instância no Atlas One.
2. Backend chama `POST /instance/create` na Evolution API.
3. Admin solicita conexão e recebe QR Code via `GET /instance/connect/{instance}`.
4. Evolution API envia webhooks para `/webhook/evolution`.
5. Backend normaliza mensagens e salva em banco.
6. Frontend recebe atualização via Socket.IO.
7. Atendente responde pelo Atlas One.
8. Backend envia texto por `POST /message/sendText/{instance}`.

## Modo simulado x real

- `Simulado`: útil para demonstração sem WhatsApp real. Não entrega mensagem no celular do cliente.
- `Evolution API`: exige `EVOLUTION_URL`, `EVOLUTION_API_KEY` e instância conectada. Se faltar configuração, o Atlas One bloqueia o envio em vez de fingir sucesso.

## Próxima evolução técnica

Prioridade recomendada:

1. Migrar `data/db.json` para PostgreSQL.
2. Criar módulos `routes/`, `services/`, `repositories/` e `middleware/`.
3. Adicionar autenticação real e hash de senha.
4. Proteger webhook com secret.
5. Persistir mídia e status de entrega.
6. Criar jobs de reconciliação de instâncias e mensagens.
