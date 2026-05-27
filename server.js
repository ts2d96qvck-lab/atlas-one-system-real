const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

loadEnvFile();

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");
const WHATSAPP_REAL_ONLY = process.env.ATLAS_ALLOW_SIMULATED_WHATSAPP !== "true";

const DEFAULT_FUNNEL_STAGES = [
  "Novos leads",
  "Contato feito",
  "Reunião marcada",
  "Proposta enviada",
  "Negociação",
  "Fechado",
  "Perdido"
];

const DEFAULT_TAGS = [
  "enterprise",
  "whatsapp",
  "cobrança",
  "call center",
  "proposta",
  "prioridade"
];

const EVOLUTION_WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "PRESENCE_UPDATE",
  "CHATS_UPSERT",
  "CHATS_UPDATE"
];

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  setHeaders: response => {
    response.setHeader("Cache-Control", "no-store");
  }
}));

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function now() {
  return new Date().toISOString();
}

function normalizeInstanceStatus(status) {
  const map = {
    Simulado: "Desconectado",
    Criada: "Desconectado",
    connected: "Conectado",
    open: "Conectado",
    close: "Desconectado",
    disconnected: "Desconectado",
    connecting: "Aguardando QR"
  };
  const next = map[status] || status || "Desconectado";
  return ["Conectado", "Desconectado", "Aguardando QR", "Falha"].includes(next) ? next : "Desconectado";
}

function normalizeMessageStatus(status) {
  const map = {
    ERROR: "falha",
    FAILED: "falha",
    PENDING: "pendente",
    SERVER_ACK: "enviada",
    DEVICE_ACK: "entregue",
    DELIVERY_ACK: "entregue",
    READ: "lida",
    READ_ACK: "lida",
    PLAYED: "reproduzida"
  };
  const normalized = String(status || "").trim();
  return map[normalized.toUpperCase()] || normalized.toLowerCase() || "registrada";
}

function normalizePresence(status) {
  const map = {
    composing: "digitando",
    recording: "gravando áudio",
    paused: "",
    available: "online",
    unavailable: ""
  };
  return map[String(status || "").toLowerCase()] || "";
}

function normalizeDb(db) {
  db.settings = {
    companyName: "Atlas One",
    workspaceName: "Operação Comercial",
    evolutionUrl: "http://localhost:8080",
    evolutionApiKey: "CHANGE_ME",
    defaultInstance: "atlas-one-main",
    deliveryMode: "Evolution API",
    visualDensity: "Confortável",
    accentColor: "Clean",
    funnelStages: DEFAULT_FUNNEL_STAGES,
    tags: DEFAULT_TAGS,
    ...(db.settings || {})
  };

  db.settings.evolutionUrl = process.env.EVOLUTION_URL || db.settings.evolutionUrl;
  db.settings.evolutionApiKey = process.env.EVOLUTION_API_KEY || db.settings.evolutionApiKey;
  db.settings.defaultInstance = process.env.EVOLUTION_DEFAULT_INSTANCE || db.settings.defaultInstance;
  if (WHATSAPP_REAL_ONLY) db.settings.deliveryMode = "Evolution API";

  db.settings.funnelStages = Array.isArray(db.settings.funnelStages) && db.settings.funnelStages.length
    ? db.settings.funnelStages
    : DEFAULT_FUNNEL_STAGES;

  db.settings.tags = Array.isArray(db.settings.tags) && db.settings.tags.length
    ? db.settings.tags
    : DEFAULT_TAGS;

  db.users = Array.isArray(db.users) ? db.users : [];
  db.instances = Array.isArray(db.instances) ? db.instances : [];
  db.conversations = Array.isArray(db.conversations) ? db.conversations : [];
  db.messages = Array.isArray(db.messages) ? db.messages : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.activity = Array.isArray(db.activity) ? db.activity : [];

  db.users = db.users.map(user => ({
    permissions: [],
    online: true,
    capacity: 12,
    productivity: { resolvedToday: 0, averageResponseMinutes: 0, conversionRate: 0 },
    ...user
  }));

  db.instances = db.instances.map(instance => {
    const status = normalizeInstanceStatus(instance.status);
    return {
      id: instance.id || randomUUID(),
      name: instance.name,
      label: instance.label || instance.name,
      phone: instance.phone || "",
      status,
      type: instance.type || "WhatsApp Business",
      ownerTeam: instance.ownerTeam || "Comercial",
      lastSync: instance.lastSync || (status === "Conectado" ? instance.createdAt || now() : null),
      connectedAt: instance.connectedAt || (status === "Conectado" ? instance.createdAt || now() : null),
      disconnectedAt: instance.disconnectedAt || null,
      connectionRequestedAt: instance.connectionRequestedAt || null,
      connectionExpiresAt: instance.connectionExpiresAt || null,
      connectionEvents: Array.isArray(instance.connectionEvents) ? instance.connectionEvents.slice(0, 30) : [],
      createdAt: instance.createdAt || now(),
      evolution: instance.evolution || null
    };
  });

  if (WHATSAPP_REAL_ONLY && !shouldUseEvolution(db)) {
    db.instances = db.instances.map(instance => ({
      ...instance,
      status: "Desconectado",
      connectedAt: null
    }));
  }

  db.conversations = db.conversations.map(conversation => ({
    priority: conversation.priority || "Normal",
    tags: Array.isArray(conversation.tags) ? conversation.tags : [],
    notes: conversation.notes || "",
    history: Array.isArray(conversation.history) ? conversation.history : [],
    unreadCount: Number(conversation.unreadCount || 0),
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || now(),
    presence: conversation.presence || null,
    avatarUrl: conversation.avatarUrl || "",
    status: normalizeConversationStatus(conversation.status),
    createdAt: conversation.createdAt || now(),
    updatedAt: conversation.updatedAt || conversation.createdAt || now(),
    ...conversation,
    unreadCount: Number(conversation.unreadCount || 0),
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || now(),
    status: normalizeConversationStatus(conversation.status)
  }));

  db.messages = db.messages.map(message => ({
    id: message.id || randomUUID(),
    conversationId: message.conversationId,
    direction: message.direction || "in",
    type: message.type || "text",
    text: message.text || "",
    userId: message.userId || null,
    status: normalizeMessageStatus(message.status || (message.direction === "out" ? "enviada" : "recebida")),
    delivery: message.delivery || "Atlas One",
    externalId: message.externalId || null,
    instance: message.instance || null,
    remoteJid: message.remoteJid || null,
    quotedMessageId: message.quotedMessageId || null,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    media: message.media || null,
    location: message.location || null,
    contact: message.contact || null,
    raw: message.raw || null,
    createdAt: message.createdAt || now(),
    updatedAt: message.updatedAt || message.createdAt || now()
  }));

  db.leads = db.leads.map(lead => ({
    id: lead.id || randomUUID(),
    company: lead.company || "",
    contact: lead.contact || lead.name || "",
    phone: String(lead.phone || "").replace(/\D/g, ""),
    email: lead.email || "",
    origin: lead.origin || "WhatsApp",
    status: normalizeLeadStatus(lead.status, db.settings.funnelStages),
    temperature: lead.temperature || "Morno",
    value: Number(lead.value || 0),
    assignedTo: lead.assignedTo || null,
    notes: lead.notes || "",
    nextFollowUp: lead.nextFollowUp || "",
    history: Array.isArray(lead.history) ? lead.history : [],
    createdAt: lead.createdAt || now(),
    updatedAt: lead.updatedAt || lead.createdAt || now(),
    conversationId: lead.conversationId || null,
    ...lead,
    status: normalizeLeadStatus(lead.status, db.settings.funnelStages),
    value: Number(lead.value || 0),
    phone: String(lead.phone || "").replace(/\D/g, "")
  }));

  return db;
}

function normalizeConversationStatus(status) {
  const map = {
    Novo: "Aberto",
    Quente: "Aberto",
    CRM: "Pendente",
    Aguardando: "Aguardando cliente",
    Fechado: "Resolvido"
  };

  const allowed = ["Aberto", "Pendente", "Resolvido", "Aguardando cliente"];
  const next = map[status] || status || "Aberto";
  return allowed.includes(next) ? next : "Aberto";
}

function normalizeLeadStatus(status, stages = DEFAULT_FUNNEL_STAGES) {
  const map = {
    Novo: "Novos leads",
    Conversando: "Contato feito",
    "Reunião agendada": "Reunião marcada",
    "Fechado ganho": "Fechado",
    "Fechado perdido": "Perdido"
  };

  const next = map[status] || status || stages[0];
  return stages.includes(next) ? next : stages[0];
}

function readDb() {
  const raw = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, "utf8") : "{}";
  return normalizeDb(JSON.parse((raw || "{}").replace(/^\uFEFF/, "")));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(normalizeDb(db), null, 2), "utf8");
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function getUser(req, db) {
  const id = req.headers["x-user-id"];
  return db.users.find(user => user.id === id);
}

function isManager(user) {
  return ["Admin", "Supervisor", "Gerente"].includes(user?.role);
}

function requireUser(req, res, next) {
  const db = readDb();
  const user = getUser(req, db);

  if (!user || user.status !== "Aprovado") {
    return res.status(401).json({ error: "Não autorizado" });
  }

  req.db = db;
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!isManager(req.user)) {
    return res.status(403).json({ error: "Apenas administradores e supervisores podem executar esta ação" });
  }

  next();
}

function evolutionHeaders(db) {
  return {
    apikey: db.settings.evolutionApiKey,
    "Content-Type": "application/json"
  };
}

function evolutionBase(db) {
  return String(db.settings.evolutionUrl || "").replace(/\/$/, "");
}

function shouldUseEvolution(db) {
  return Boolean(db.settings.deliveryMode === "Evolution API"
    && db.settings.evolutionApiKey
    && db.settings.evolutionApiKey !== "CHANGE_ME"
    && db.settings.evolutionUrl);
}

function wantsRealDelivery(db) {
  return WHATSAPP_REAL_ONLY || db.settings.deliveryMode === "Evolution API";
}

function ensureEvolutionConfigured(db) {
  if (!wantsRealDelivery(db)) return null;
  if (!db.settings.evolutionUrl || !db.settings.evolutionApiKey || db.settings.evolutionApiKey === "CHANGE_ME") {
    return "WhatsApp real obrigatório: configure a URL e a API Key da Evolution API antes de enviar mensagens.";
  }
  return null;
}

function evolutionErrorText(error) {
  return JSON.stringify(error.response?.data || error.message || "");
}

function isEvolutionInstanceMissing(error) {
  return error.response?.status === 404 && /instance.*does not exist|not found/i.test(evolutionErrorText(error));
}

function isEvolutionInstanceAlreadyCreated(error) {
  return /already exists|already created|already registered|exist/i.test(evolutionErrorText(error));
}

async function createEvolutionInstance(db, instanceName, phone) {
  try {
    const response = await axios.post(
      `${evolutionBase(db)}/instance/create`,
      {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        number: phone || undefined
      },
      { headers: evolutionHeaders(db), timeout: 20000 }
    );
    return response.data;
  } catch (error) {
    if (isEvolutionInstanceAlreadyCreated(error)) {
      return { alreadyExists: true, details: error.response?.data || error.message };
    }
    throw error;
  }
}

function atlasWebhookUrl(req) {
  if (process.env.ATLAS_WEBHOOK_URL) return process.env.ATLAS_WEBHOOK_URL.replace(/\/$/, "");
  const base = req
    ? `${req.protocol}://${req.get("host")}`
    : `http://localhost:${PORT}`;

  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(base)) {
    return `http://host.docker.internal:${PORT}/webhook/evolution`;
  }

  return `${base.replace(/\/$/, "")}/webhook/evolution`;
}

async function configureEvolutionWebhook(db, instanceName, req = null) {
  if (!shouldUseEvolution(db)) return null;
  const url = atlasWebhookUrl(req);
  const payload = {
    webhook: {
      enabled: true,
      url,
      webhookByEvents: false,
      webhookBase64: true,
      events: EVOLUTION_WEBHOOK_EVENTS
    }
  };

  try {
    const response = await axios.post(
      `${evolutionBase(db)}/webhook/set/${instanceName}`,
      payload,
      { headers: evolutionHeaders(db), timeout: 15000 }
    );
    return { url, response: response.data };
  } catch (error) {
    return { url, error: error.response?.data || error.message };
  }
}

function findInstance(db, name) {
  return db.instances.find(item => item.name === name);
}

function markInstanceEvent(instance, description) {
  instance.connectionEvents = [
    {
      id: randomUUID(),
      description,
      createdAt: now()
    },
    ...(instance.connectionEvents || [])
  ].slice(0, 30);
}

function seedConversationsForInstance(db, instance, userId) {
  const existing = db.conversations.some(conversation => conversation.instance === instance.name);
  if (existing) return 0;

  const samples = [
    {
      customerName: "Helena Martins",
      customerPhone: "5511987665544",
      company: "MatrizPay Fintech",
      text: "Oi, recebi o contato de vocês e quero entender a implantação para equipe comercial.",
      tags: ["whatsapp", "enterprise"]
    },
    {
      customerName: "Daniel Campos",
      customerPhone: "5511987001122",
      company: "Vitta Seguros",
      text: "Podemos falar sobre atendimento por múltiplos números na semana que vem?",
      tags: ["whatsapp", "proposta"]
    }
  ];

  samples.forEach(sample => {
    const conversation = {
      id: randomUUID(),
      instance: instance.name,
      customerName: sample.customerName,
      customerPhone: sample.customerPhone,
      company: sample.company,
      status: "Aberto",
      priority: "Normal",
      assignedTo: userId || null,
      tags: sample.tags,
      notes: "Conversa sincronizada pelo canal WhatsApp.",
      history: [
        {
          id: randomUUID(),
          description: "Conversa carregada pela sincronização do número.",
          userId: "system",
          createdAt: now()
        }
      ],
      createdAt: now(),
      updatedAt: now()
    };

    db.conversations.unshift(conversation);
    db.messages.push({
      id: randomUUID(),
      conversationId: conversation.id,
      direction: "in",
      text: sample.text,
      userId: null,
      status: "recebida",
      delivery: "Historico local",
      createdAt: now()
    });
  });

  return samples.length;
}

function canSeeConversation(user, conversation) {
  if (isManager(user)) return true;
  return conversation.assignedTo === user.id || !conversation.assignedTo;
}

function audit(db, type, title, description, userId = "system", entityId = null) {
  db.activity.unshift({
    id: randomUUID(),
    type,
    title,
    description,
    userId,
    entityId,
    createdAt: now()
  });

  db.activity = db.activity.slice(0, 150);
}

function emitAll() {
  io.emit("atlas:update");
}

function touchConversation(conversation, description, userId) {
  conversation.updatedAt = now();
  conversation.history = [
    {
      id: randomUUID(),
      description,
      userId,
      createdAt: now()
    },
    ...(conversation.history || [])
  ].slice(0, 40);
}

function simulatedReplyText(text) {
  const normalized = text.toLowerCase();

  if (normalized.includes("proposta")) {
    return "Recebi a proposta. Vou revisar com a diretoria e retorno ainda hoje.";
  }

  if (normalized.includes("reunião") || normalized.includes("reuniao")) {
    return "Perfeito. Pode sugerir dois horários para alinharmos a reunião?";
  }

  if (normalized.includes("valor") || normalized.includes("preço") || normalized.includes("preco")) {
    return "Faz sentido. Preciso entender o escopo para validar investimento e prazo.";
  }

  return "Obrigado pelo retorno. Vou analisar internamente e sigo por aqui.";
}

function scheduleSimulatedReply(conversationId, sentText) {
  setTimeout(() => {
    const db = readDb();
    const conversation = db.conversations.find(item => item.id === conversationId);
    if (!conversation) return;

    const message = {
      id: randomUUID(),
      conversationId,
      direction: "in",
      text: simulatedReplyText(sentText),
      userId: null,
      status: "recebida",
      delivery: "Historico local",
      createdAt: now()
    };

    db.messages.push(message);
    conversation.status = "Aberto";
    touchConversation(conversation, "Resposta registrada no historico local.", "system");
    audit(db, "Mensagem", "Resposta registrada", `${conversation.customerName} respondeu no WhatsApp.`, "system", conversationId);
    writeDb(db);
    emitAll();
  }, 1100);
}

app.post("/api/login", (req, res) => {
  const db = readDb();
  const { email, password } = req.body;

  const user = db.users.find(
    item =>
      item.email.toLowerCase() === String(email || "").toLowerCase() &&
      item.password === password
  );

  if (!user) return res.status(401).json({ error: "Login inválido" });
  if (user.status !== "Aprovado") return res.status(403).json({ error: "Usuário bloqueado ou pendente" });

  user.online = true;
  writeDb(db);

  res.json({ user: publicUser(user) });
});

app.get("/api/health", (req, res) => {
  const db = readDb();
  res.json({
    ok: true,
    server: "online",
    whatsapp: {
      mode: "Evolution API",
      realOnly: WHATSAPP_REAL_ONLY,
      configured: shouldUseEvolution(db),
      apiUrl: db.settings.evolutionUrl,
      defaultInstance: db.settings.defaultInstance,
      connectedInstances: shouldUseEvolution(db) ? db.instances.filter(instance => instance.status === "Conectado").length : 0,
      totalInstances: db.instances.length
    }
  });
});

app.get("/api/bootstrap", requireUser, (req, res) => {
  const db = req.db;
  const visibleConversations = db.conversations.filter(conv => canSeeConversation(req.user, conv));
  const visibleConversationIds = new Set(visibleConversations.map(conv => conv.id));
  const visibleLeads = isManager(req.user)
    ? db.leads
    : db.leads.filter(lead => lead.assignedTo === req.user.id);

  res.json({
    me: publicUser(req.user),
    settings: db.settings,
    users: db.users.map(publicUser),
    instances: db.instances,
    conversations: visibleConversations,
    messages: db.messages.filter(msg => visibleConversationIds.has(msg.conversationId)),
    leads: visibleLeads,
    activity: db.activity.slice(0, 80)
  });
});

app.patch("/api/settings", requireUser, requireAdmin, (req, res) => {
  const db = req.db;
  const nextSettings = { ...db.settings, ...req.body };

  if (typeof nextSettings.tags === "string") {
    nextSettings.tags = nextSettings.tags.split(",").map(item => item.trim()).filter(Boolean);
  }

  if (typeof nextSettings.funnelStages === "string") {
    nextSettings.funnelStages = nextSettings.funnelStages.split("\n").map(item => item.trim()).filter(Boolean);
  }

  nextSettings.funnelStages = Array.isArray(nextSettings.funnelStages) && nextSettings.funnelStages.length
    ? nextSettings.funnelStages
    : DEFAULT_FUNNEL_STAGES;

  nextSettings.tags = Array.isArray(nextSettings.tags) && nextSettings.tags.length
    ? nextSettings.tags
    : DEFAULT_TAGS;

  db.settings = nextSettings;
  audit(db, "Configuração", "Configurações atualizadas", "Preferências do workspace foram alteradas.", req.user.id);
  writeDb(db);
  emitAll();
  res.json(db.settings);
});

app.post("/api/users", requireUser, requireAdmin, (req, res) => {
  const db = req.db;
  const { name, email, password = "123456", role = "Atendente" } = req.body;

  if (!name || !email) return res.status(400).json({ error: "Nome e e-mail são obrigatórios" });
  if (db.users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Este e-mail já existe" });
  }

  const user = {
    id: randomUUID(),
    name: String(name).trim(),
    email: String(email).trim(),
    password,
    role,
    status: "Aprovado",
    online: false,
    capacity: Number(req.body.capacity || 12),
    permissions: [],
    productivity: { resolvedToday: 0, averageResponseMinutes: 0, conversionRate: 0 }
  };

  db.users.push(user);
  audit(db, "Usuário", "Novo usuário criado", `${user.name} foi adicionado à operação.`, req.user.id, user.id);
  writeDb(db);
  emitAll();

  res.status(201).json(publicUser(user));
});

app.patch("/api/users/:id", requireUser, requireAdmin, (req, res) => {
  const db = req.db;
  const user = db.users.find(item => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  const allowed = ["name", "email", "role", "status", "online", "capacity", "permissions", "productivity"];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  audit(db, "Usuário", "Usuário atualizado", `${user.name} teve seus dados atualizados.`, req.user.id, user.id);
  writeDb(db);
  emitAll();

  res.json(publicUser(user));
});

app.patch("/api/me", requireUser, (req, res) => {
  const db = req.db;
  const user = db.users.find(item => item.id === req.user.id);

  const { name, email, currentPassword, newPassword } = req.body;

  if (email && db.users.some(item => item.id !== user.id && item.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "E-mail já está em uso" });
  }

  if (newPassword) {
    if (user.password !== currentPassword) return res.status(400).json({ error: "Senha atual incorreta" });
    user.password = newPassword;
  }

  if (name) user.name = String(name).trim();
  if (email) user.email = String(email).trim();

  audit(db, "Perfil", "Perfil atualizado", `${user.name} atualizou o próprio perfil.`, user.id, user.id);
  writeDb(db);
  emitAll();

  res.json(publicUser(user));
});

app.post("/api/instances", requireUser, requireAdmin, async (req, res) => {
  const db = req.db;
  const { name, label, phone, ownerTeam = "Comercial" } = req.body;
  const instanceName = String(name || `atlas-${Date.now()}`).trim();

  if (!instanceName) return res.status(400).json({ error: "Nome da instância é obrigatório" });

  try {
    const configError = ensureEvolutionConfigured(db);
    if (configError) return res.status(409).json({ error: configError });

    let evolution = null;
    const existing = findInstance(db, instanceName);

    if (shouldUseEvolution(db)) {
      evolution = await createEvolutionInstance(db, instanceName, phone);
    }

    if (existing) {
      existing.label = label || existing.label || instanceName;
      existing.phone = phone || existing.phone || "";
      existing.ownerTeam = ownerTeam || existing.ownerTeam || "Comercial";
      existing.status = shouldUseEvolution(db) ? "Criada" : existing.status;
      existing.evolution = evolution || existing.evolution || null;
      db.settings.defaultInstance = instanceName;
      markInstanceEvent(existing, "Instância preparada na Evolution API.");
      audit(db, "Número", "Número atualizado", `${existing.label} foi preparado para conexão.`, req.user.id, existing.id);
      writeDb(db);
      emitAll();
      return res.json({ ...existing, reused: true });
    }

    const instance = {
      id: randomUUID(),
      name: instanceName,
      label: label || instanceName,
      phone: phone || "",
      status: shouldUseEvolution(db) ? "Criada" : "Desconectado",
      type: "WhatsApp Business",
      ownerTeam,
      createdAt: now(),
      evolution
    };

    db.instances.push(instance);
    db.settings.defaultInstance = instanceName;
    audit(db, "Número", "Número adicionado", `${instance.label} foi incluído como canal de atendimento.`, req.user.id, instance.id);
    writeDb(db);
    emitAll();

    res.status(201).json(instance);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao criar instância na Evolution API",
      details: error.response?.data || error.message
    });
  }
});

app.get("/api/instances/:name/connect", requireUser, requireAdmin, async (req, res) => {
  const db = req.db;
  const instance = findInstance(db, req.params.name);
  if (!instance) return res.status(404).json({ error: "Número não encontrado" });

  try {
    const configError = ensureEvolutionConfigured(db);
    if (configError) return res.status(409).json({ error: configError });

    if (!shouldUseEvolution(db)) {
      const qrImage = await QRCode.toDataURL(`atlas-one-local://${req.params.name}`);
      instance.status = "Conectado";
      instance.connectedAt = now();
      instance.lastSync = now();
      instance.connectionRequestedAt = now();
      instance.connectionExpiresAt = null;
      markInstanceEvent(instance, "Numero conectado em modo local.");
      const importedConversations = seedConversationsForInstance(db, instance, req.user.id);
      audit(db, "Número", "Número conectado", `${instance.label} foi conectado em modo local.`, req.user.id, instance.id);
      writeDb(db);
      emitAll();
      return res.json({
        mode: "Local",
        status: "Conectado",
        pairingCode: "ATLAS-ONE",
        lastSync: instance.lastSync,
        importedConversations,
        warning: "Modo local nao entrega mensagens no WhatsApp real. Para envio real, configure Evolution API.",
        qrImage
      });
    }

    let response;
    try {
      response = await axios.get(
        `${evolutionBase(db)}/instance/connect/${req.params.name}`,
        { headers: evolutionHeaders(db), timeout: 20000 }
      );
    } catch (error) {
      if (!isEvolutionInstanceMissing(error)) throw error;
      instance.evolution = await createEvolutionInstance(db, req.params.name, instance.phone);
      markInstanceEvent(instance, "Instância recriada na Evolution API antes do QR Code.");
      response = await axios.get(
        `${evolutionBase(db)}/instance/connect/${req.params.name}`,
        { headers: evolutionHeaders(db), timeout: 20000 }
      );
    }

    let qrImage = null;
    const qrCode = response.data?.code || response.data?.qrcode?.code || response.data?.qrcode;
    const remoteQrImage = response.data?.base64 || response.data?.qrcode?.base64;
    if (typeof remoteQrImage === "string" && remoteQrImage.startsWith("data:image")) {
      qrImage = remoteQrImage;
    } else if (qrCode && typeof qrCode === "string") {
      qrImage = await QRCode.toDataURL(qrCode);
    }

    instance.status = qrCode || qrImage ? "Aguardando QR" : normalizeInstanceStatus(response.data?.state || response.data?.status);
    instance.connectionRequestedAt = now();
    instance.connectionExpiresAt = new Date(Date.now() + 60000).toISOString();
    markInstanceEvent(instance, "Solicitação de conexão enviada para Evolution API.");
    audit(db, "Número", "QR Code gerado", `${instance.label} aguardando leitura do QR Code.`, req.user.id, instance.id);
    writeDb(db);
    emitAll();

    res.json({
      ...response.data,
      status: instance.status,
      lastSync: instance.lastSync,
      qrImage
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao conectar instância",
      details: error.response?.data || error.message
    });
  }
});

app.get("/api/instances/:name/state", requireUser, async (req, res) => {
  const db = req.db;

  try {
    const configError = ensureEvolutionConfigured(db);
    if (configError) return res.status(409).json({ error: configError });

    const instance = findInstance(db, req.params.name);
    if (!instance) return res.status(404).json({ error: "Número não encontrado" });

    if (!shouldUseEvolution(db)) {
      instance.status = "Conectado";
      instance.lastSync = now();
      markInstanceEvent(instance, "Estado consultado em modo local.");
      writeDb(db);

      return res.json({ mode: "Local", state: "connected", status: instance.status, lastSync: instance.lastSync });
    }

    const response = await axios.get(
      `${evolutionBase(db)}/instance/connectionState/${req.params.name}`,
      { headers: evolutionHeaders(db), timeout: 15000 }
    );

    instance.status = normalizeInstanceStatus(response.data?.instance?.state || response.data?.state || response.data?.status);
    if (instance.status === "Conectado") {
      instance.connectedAt = instance.connectedAt || now();
      instance.lastSync = now();
    }
    markInstanceEvent(instance, `Estado atualizado: ${instance.status}.`);
    writeDb(db);

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao consultar estado",
      details: error.response?.data || error.message
    });
  }
});

app.post("/api/instances/:name/sync", requireUser, requireAdmin, async (req, res) => {
  const db = req.db;
  const instance = findInstance(db, req.params.name);
  if (!instance) return res.status(404).json({ error: "Número não encontrado" });

  try {
    let importedConversations = 0;
    const configError = ensureEvolutionConfigured(db);
    if (configError) return res.status(409).json({ error: configError });

    if (shouldUseEvolution(db)) {
      await axios.get(
        `${evolutionBase(db)}/instance/connectionState/${req.params.name}`,
        { headers: evolutionHeaders(db), timeout: 15000 }
      );
      instance.status = "Conectado";
    } else {
      importedConversations = seedConversationsForInstance(db, instance, req.user.id);
      instance.status = "Conectado";
    }

    instance.lastSync = now();
    markInstanceEvent(instance, importedConversations
      ? `${importedConversations} conversas carregadas na sincronização.`
      : "Sincronização concluída sem novas conversas.");
    audit(db, "Número", "Número sincronizado", `${instance.label} foi sincronizado.`, req.user.id, instance.id);
    writeDb(db);
    emitAll();

    res.json({ ok: true, status: instance.status, lastSync: instance.lastSync, importedConversations });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao sincronizar número",
      details: error.response?.data || error.message
    });
  }
});

app.post("/api/instances/:name/disconnect", requireUser, requireAdmin, async (req, res) => {
  const db = req.db;
  const instance = findInstance(db, req.params.name);
  if (!instance) return res.status(404).json({ error: "Número não encontrado" });

  try {
    if (shouldUseEvolution(db)) {
      await axios.delete(
        `${evolutionBase(db)}/instance/logout/${req.params.name}`,
        { headers: evolutionHeaders(db), timeout: 15000 }
      ).catch(async () => {
        await axios.get(
          `${evolutionBase(db)}/instance/logout/${req.params.name}`,
          { headers: evolutionHeaders(db), timeout: 15000 }
        );
      });
    }

    instance.status = "Desconectado";
    instance.disconnectedAt = now();
    markInstanceEvent(instance, "Número desconectado.");
    audit(db, "Número", "Número desconectado", `${instance.label} foi desconectado.`, req.user.id, instance.id);
    writeDb(db);
    emitAll();

    res.json({ ok: true, status: instance.status, disconnectedAt: instance.disconnectedAt });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao desconectar número",
      details: error.response?.data || error.message
    });
  }
});

app.patch("/api/conversations/:id", requireUser, (req, res) => {
  const db = req.db;
  const conversation = db.conversations.find(item => item.id === req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });
  if (!canSeeConversation(req.user, conversation)) return res.status(403).json({ error: "Sem acesso a esta conversa" });

  const { customerName, company, status, assignedTo, tags, notes, priority } = req.body;

  if (assignedTo !== undefined && !isManager(req.user)) {
    return res.status(403).json({ error: "Apenas administradores e supervisores podem transferir conversas" });
  }

  if (customerName !== undefined) conversation.customerName = String(customerName).trim();
  if (company !== undefined) conversation.company = String(company).trim();
  if (status !== undefined) conversation.status = normalizeConversationStatus(status);
  if (assignedTo !== undefined) conversation.assignedTo = assignedTo || null;
  if (Array.isArray(tags)) conversation.tags = tags;
  if (notes !== undefined) conversation.notes = String(notes);
  if (priority !== undefined) conversation.priority = priority;

  touchConversation(conversation, "Dados da conversa atualizados.", req.user.id);
  audit(db, "Conversa", "Conversa atualizada", `${conversation.customerName} teve dados operacionais atualizados.`, req.user.id, conversation.id);
  writeDb(db);
  emitAll();

  res.json(conversation);
});

app.post("/api/conversations/:id/messages", requireUser, async (req, res) => {
  const db = req.db;
  const conversation = db.conversations.find(item => item.id === req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });
  if (!canSeeConversation(req.user, conversation)) return res.status(403).json({ error: "Sem acesso a esta conversa" });

  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Mensagem vazia" });

  const instanceName = conversation.instance || db.settings.defaultInstance;
  const number = conversation.customerPhone.replace(/\D/g, "");
  let delivery = "Evolution API";

  try {
    const configError = ensureEvolutionConfigured(db);
    if (configError) return res.status(409).json({ error: configError });

    if (!shouldUseEvolution(db)) {
      return res.status(409).json({ error: "Envio local desativado. Ative e conecte a Evolution API para enviar WhatsApp real." });
    }

    await axios.post(
      `${evolutionBase(db)}/message/sendText/${instanceName}`,
      {
        number,
        text,
        delay: 800,
        linkPreview: false
      },
      { headers: evolutionHeaders(db), timeout: 30000 }
    );

    const message = {
      id: randomUUID(),
      conversationId: conversation.id,
      direction: "out",
      text,
      userId: req.user.id,
      status: "enviada",
      delivery,
      createdAt: now()
    };

    db.messages.push(message);
    conversation.status = "Aguardando cliente";
    touchConversation(conversation, `Mensagem enviada via ${delivery}.`, req.user.id);
    audit(db, "Mensagem", "Mensagem enviada", `${req.user.name} enviou mensagem para ${conversation.customerName}.`, req.user.id, conversation.id);
    writeDb(db);
    emitAll();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao enviar mensagem pela Evolution API",
      details: error.response?.data || error.message
    });
  }
});

app.post("/api/conversations", requireUser, (req, res) => {
  const db = req.db;
  const { customerName, customerPhone, company, instance, tags = [] } = req.body;

  if (!customerPhone) return res.status(400).json({ error: "Telefone é obrigatório" });

  const conversation = {
    id: randomUUID(),
    instance: instance || db.settings.defaultInstance,
    customerName: customerName || customerPhone,
    customerPhone: String(customerPhone).replace(/\D/g, ""),
    company: company || "",
    status: "Aberto",
    priority: req.body.priority || "Normal",
    assignedTo: req.body.assignedTo || req.user.id,
    tags: Array.isArray(tags) ? tags : [],
    notes: "",
    history: [
      {
        id: randomUUID(),
        description: "Conversa criada manualmente.",
        userId: req.user.id,
        createdAt: now()
      }
    ],
    createdAt: now(),
    updatedAt: now()
  };

  db.conversations.unshift(conversation);
  audit(db, "Conversa", "Nova conversa criada", `${conversation.customerName} entrou na fila de atendimento.`, req.user.id, conversation.id);
  writeDb(db);
  emitAll();

  res.status(201).json(conversation);
});

app.post("/api/conversations/:id/lead", requireUser, (req, res) => {
  const db = req.db;
  const conversation = db.conversations.find(item => item.id === req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });
  if (!canSeeConversation(req.user, conversation)) return res.status(403).json({ error: "Sem acesso a esta conversa" });

  const existing = db.leads.find(lead => lead.conversationId === conversation.id);
  if (existing) return res.status(200).json(existing);

  const lead = {
    id: randomUUID(),
    company: conversation.company || conversation.customerName,
    contact: conversation.customerName,
    phone: conversation.customerPhone,
    email: "",
    origin: "WhatsApp",
    status: db.settings.funnelStages[0],
    temperature: conversation.priority === "Alta" ? "Quente" : "Morno",
    value: Number(req.body.value || 0),
    assignedTo: conversation.assignedTo || req.user.id,
    notes: `Criado a partir do WhatsApp. ${conversation.notes || ""}`.trim(),
    nextFollowUp: req.body.nextFollowUp || "",
    conversationId: conversation.id,
    history: [
      {
        id: randomUUID(),
        description: "Lead criado a partir da conversa de WhatsApp.",
        userId: req.user.id,
        createdAt: now()
      }
    ],
    createdAt: now(),
    updatedAt: now()
  };

  db.leads.unshift(lead);
  conversation.status = "Pendente";
  conversation.tags = Array.from(new Set([...(conversation.tags || []), "crm"]));
  touchConversation(conversation, "Lead criado e associado ao CRM.", req.user.id);
  audit(db, "Lead", "Lead criado pelo WhatsApp", `${lead.company} foi associado ao CRM.`, req.user.id, lead.id);

  writeDb(db);
  emitAll();

  res.status(201).json(lead);
});

app.post("/api/leads", requireUser, (req, res) => {
  const db = req.db;
  const lead = {
    id: randomUUID(),
    company: String(req.body.company || "").trim(),
    contact: String(req.body.contact || "").trim(),
    phone: String(req.body.phone || "").replace(/\D/g, ""),
    email: String(req.body.email || "").trim(),
    origin: req.body.origin || "Manual",
    status: normalizeLeadStatus(req.body.status, db.settings.funnelStages),
    temperature: req.body.temperature || "Morno",
    value: Number(req.body.value || 0),
    assignedTo: req.body.assignedTo || req.user.id,
    notes: req.body.notes || "",
    nextFollowUp: req.body.nextFollowUp || "",
    history: [
      {
        id: randomUUID(),
        description: "Lead cadastrado manualmente no CRM.",
        userId: req.user.id,
        createdAt: now()
      }
    ],
    createdAt: now(),
    updatedAt: now(),
    conversationId: req.body.conversationId || null
  };

  if (!lead.company || !lead.contact || !lead.phone) {
    return res.status(400).json({ error: "Empresa, contato e WhatsApp são obrigatórios" });
  }

  db.leads.unshift(lead);
  audit(db, "Lead", "Lead cadastrado", `${lead.company} entrou no CRM.`, req.user.id, lead.id);
  writeDb(db);
  emitAll();

  res.status(201).json(lead);
});

app.patch("/api/leads/:id", requireUser, (req, res) => {
  const db = req.db;
  const lead = db.leads.find(item => item.id === req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const previousStatus = lead.status;
  const allowed = [
    "company",
    "contact",
    "phone",
    "email",
    "origin",
    "status",
    "temperature",
    "value",
    "assignedTo",
    "notes",
    "nextFollowUp",
    "conversationId"
  ];

  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      lead[field] = field === "value"
        ? Number(req.body[field] || 0)
        : req.body[field];
    }
  });

  lead.phone = String(lead.phone || "").replace(/\D/g, "");
  lead.status = normalizeLeadStatus(lead.status, db.settings.funnelStages);
  lead.updatedAt = now();

  const description = previousStatus !== lead.status
    ? `Lead movido de ${previousStatus} para ${lead.status}.`
    : "Dados do lead atualizados.";

  lead.history = [
    {
      id: randomUUID(),
      description,
      userId: req.user.id,
      createdAt: now()
    },
    ...(lead.history || [])
  ].slice(0, 40);

  audit(db, "Lead", "Lead atualizado", `${lead.company} foi atualizado no CRM.`, req.user.id, lead.id);
  writeDb(db);
  emitAll();
  res.json(lead);
});

app.delete("/api/leads/:id", requireUser, requireAdmin, (req, res) => {
  const db = req.db;
  const lead = db.leads.find(item => item.id === req.params.id);
  db.leads = db.leads.filter(item => item.id !== req.params.id);

  if (lead) {
    audit(db, "Lead", "Lead removido", `${lead.company} foi removido do CRM.`, req.user.id, lead.id);
  }

  writeDb(db);
  emitAll();
  res.json({ ok: true });
});

app.post("/webhook/evolution", (req, res) => {
  const db = readDb();
  const body = req.body;

  const data = body.data || body;
  const remoteJid = data.key?.remoteJid || data.remoteJid || data.from;
  const text = data.message?.conversation || data.message?.extendedTextMessage?.text || data.text || data.messageText;
  const fromMe = data.key?.fromMe === true || body.event === "send.message";

  if (remoteJid && text) {
    const number = String(remoteJid).replace("@s.whatsapp.net", "").replace(/\D/g, "");

    let conversation = db.conversations.find(item => item.customerPhone === number);
    if (!conversation) {
      conversation = {
        id: randomUUID(),
        instance: body.instance || db.settings.defaultInstance,
        customerName: data.pushName || number,
        customerPhone: number,
        company: "",
        status: "Aberto",
        priority: "Normal",
        assignedTo: null,
        tags: [],
        notes: "",
        history: [],
        createdAt: now(),
        updatedAt: now()
      };
      db.conversations.unshift(conversation);
    }

    const duplicateOutgoing = fromMe && db.messages.some(message =>
      message.conversationId === conversation.id &&
      message.direction === "out" &&
      message.text === text &&
      Math.abs(new Date(message.createdAt).getTime() - Date.now()) < 120000
    );

    if (duplicateOutgoing) {
      return res.json({ ok: true, skipped: "duplicate_outgoing_echo" });
    }

    db.messages.push({
      id: randomUUID(),
      conversationId: conversation.id,
      direction: fromMe ? "out" : "in",
      text,
      userId: null,
      status: fromMe ? "enviada" : "recebida",
      delivery: "Evolution API",
      createdAt: now(),
      raw: body
    });

    conversation.status = fromMe ? "Aguardando cliente" : "Aberto";
    touchConversation(
      conversation,
      fromMe ? "Mensagem enviada fora do Atlas e sincronizada pela Evolution API." : "Mensagem recebida via webhook da Evolution API.",
      "system"
    );
    audit(
      db,
      "Mensagem",
      fromMe ? "Mensagem enviada sincronizada" : "Mensagem recebida",
      fromMe ? `Mensagem enviada para ${conversation.customerName} foi sincronizada.` : `${conversation.customerName} enviou uma nova mensagem.`,
      "system",
      conversation.id
    );

    writeDb(db);
    emitAll();
  }

  res.json({ ok: true });
});

io.on("connection", socket => {
  socket.emit("atlas:hello", { ok: true });
});

server.listen(PORT, () => {
  console.log(`Atlas One rodando em http://localhost:${PORT}`);
});
