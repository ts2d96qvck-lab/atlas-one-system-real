(() => {
  const conversationStatuses = ["Aberto", "Pendente", "Aguardando cliente", "Resolvido"];
  const defaultStages = ["Novos leads", "Contato feito", "Reunião marcada", "Proposta enviada", "Negociação", "Fechado", "Perdido"];

  const state = {
    me: null,
    settings: {},
    users: [],
    instances: [],
    conversations: [],
    messages: [],
    leads: [],
    activity: []
  };

  let currentView = "dashboard";
  let activeConversationId = null;
  let activeLeadId = null;
  let draggedLeadId = null;
  let bootstrapTimer = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const socket = window.io ? window.io() : null;

  if (socket) {
    socket.on("atlas:update", () => {
      if (!state.me) return;
      clearTimeout(bootstrapTimer);
      bootstrapTimer = setTimeout(() => bootstrap(), 160);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindEvents();
    restoreSession();
  }

  function bindEvents() {
    $("#loginForm").addEventListener("submit", login);
    $("#logoutButton").addEventListener("click", logout);
    $("#sendMessageButton").addEventListener("click", sendMessage);
    $("#saveConversationButton").addEventListener("click", saveConversationPanel);
    $("#createLeadButton").addEventListener("click", createLeadFromConversation);

    $("#replyText").addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });

    const globalSearch = $("#globalSearch");
    if (globalSearch) {
      globalSearch.addEventListener("input", handleGlobalSearch);
      globalSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") handleGlobalSearch();
      });
    }

    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#globalSearch")?.focus();
      }
    });

    $$(".nav-item").forEach(button => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    $$("[data-open-modal]").forEach(button => {
      button.addEventListener("click", () => openModal(button.dataset.openModal));
    });

    $$("[data-close-modal]").forEach(button => {
      button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });

    $$(".modal").forEach(modal => {
      modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal.id);
      });
    });

    ["conversationSearch", "conversationOwnerFilter", "conversationInstanceFilter", "conversationStatusFilter"].forEach(id => {
      $(`#${id}`).addEventListener("input", renderConversations);
      $(`#${id}`).addEventListener("change", renderConversations);
    });

    ["leadSearch", "leadStageFilter", "leadOwnerFilter"].forEach(id => {
      $(`#${id}`).addEventListener("input", renderCRM);
      $(`#${id}`).addEventListener("change", renderCRM);
    });

    document.addEventListener("click", event => {
      const conversationButton = event.target.closest("[data-conversation-id]");
      if (conversationButton) {
        activeConversationId = conversationButton.dataset.conversationId;
        renderConversations();
      }

      const leadButton = event.target.closest("[data-lead-open]");
      if (leadButton) openLeadDetail(leadButton.dataset.leadOpen);

      const statusButton = event.target.closest("[data-status-action]");
      if (statusButton) updateConversationStatus(statusButton.dataset.statusAction);

      const toggleUserButton = event.target.closest("[data-toggle-user]");
      if (toggleUserButton) toggleUser(toggleUserButton.dataset.toggleUser, toggleUserButton.dataset.nextStatus);

      const instanceConnect = event.target.closest("[data-instance-connect]");
      if (instanceConnect) connectInstance(instanceConnect.dataset.instanceConnect);

      const instanceCheck = event.target.closest("[data-instance-check]");
      if (instanceCheck) checkInstance(instanceCheck.dataset.instanceCheck);

      const instanceSync = event.target.closest("[data-instance-sync]");
      if (instanceSync) syncInstance(instanceSync.dataset.instanceSync);

      const instanceDisconnect = event.target.closest("[data-instance-disconnect]");
      if (instanceDisconnect) disconnectInstance(instanceDisconnect.dataset.instanceDisconnect);
    });

    $("#conversationForm").addEventListener("submit", createConversation);
    $("#leadForm").addEventListener("submit", createLead);
    $("#leadDetailForm").addEventListener("submit", saveLeadDetail);
    $("#detailSendMessage").addEventListener("click", sendLeadMessage);
    $("#detailOpenConversation").addEventListener("click", openLeadConversation);
    $("#detailCreateConversation").addEventListener("click", () => ensureLeadConversation(true));
    $("#userForm").addEventListener("submit", createUser);
    $("#settingsForm").addEventListener("submit", saveSettings);
    $("#profileForm").addEventListener("submit", saveProfile);
    $("#instanceForm").addEventListener("submit", createInstance);
    $("#connectInstanceButton").addEventListener("click", () => connectInstance($("#instanceName").value));
    $("#checkInstanceButton").addEventListener("click", () => checkInstance($("#instanceName").value));

    $("#leadRows").addEventListener("change", event => {
      if (event.target.matches("[data-lead-stage]")) {
        updateLead(event.target.dataset.leadStage, { status: event.target.value });
      }
    });

    $("#kanban").addEventListener("dragstart", event => {
      const card = event.target.closest("[data-lead-card]");
      if (!card) return;
      draggedLeadId = card.dataset.leadCard;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedLeadId);
    });

    $("#kanban").addEventListener("dragover", event => {
      const stage = event.target.closest("[data-stage]");
      if (!stage) return;
      event.preventDefault();
      stage.classList.add("drag-over");
    });

    $("#kanban").addEventListener("dragleave", event => {
      const stage = event.target.closest("[data-stage]");
      if (stage) stage.classList.remove("drag-over");
    });

    $("#kanban").addEventListener("drop", event => {
      const stage = event.target.closest("[data-stage]");
      if (!stage || !draggedLeadId) return;
      event.preventDefault();
      stage.classList.remove("drag-over");
      updateLead(draggedLeadId, { status: stage.dataset.stage });
      draggedLeadId = null;
    });
  }

  async function restoreSession() {
    const saved = localStorage.getItem("atlas_user");
    if (!saved) return;

    try {
      state.me = JSON.parse(saved);
      await bootstrap();
      showApp();
    } catch (error) {
      console.error(error);
      localStorage.removeItem("atlas_user");
      showToast("Sessão expirada. Entre novamente.");
    }
  }

  async function login(event) {
    event.preventDefault();

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("#loginEmail").value,
          password: $("#loginPass").value
        })
      });

      state.me = data.user;
      localStorage.setItem("atlas_user", JSON.stringify(data.user));
      await bootstrap();
      showApp();
      showToast("Bem-vindo ao Atlas One.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("atlas_user");
    state.me = null;
    location.reload();
  }

  async function bootstrap() {
    if (!state.me) return;
    const data = await api("/api/bootstrap");
    Object.assign(state, data);

    if (!activeConversationId && state.conversations[0]) {
      activeConversationId = sortedConversations(state.conversations)[0]?.id || state.conversations[0].id;
    }

    render();
  }

  async function api(url, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (state.me?.id) headers["x-user-id"] = state.me.id;

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { error: text };
    }

    if (!response.ok) {
      const details = typeof data.details === "string" ? data.details : data.details?.message;
      throw new Error(data.error || details || "Não foi possível concluir a ação");
    }

    return data;
  }

  function showApp() {
    $("#authScreen").classList.add("hidden");
    $("#appShell").classList.remove("hidden");
    render();
  }

  function setView(view) {
    currentView = view;
    $$(".view").forEach(item => item.classList.toggle("active", item.id === `${view}View`));
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));

    const titles = {
      dashboard: "Dashboard executivo",
      whatsapp: "WhatsApp Inbox",
      crm: "CRM comercial",
      pipeline: "Funil comercial",
      users: "Usuários e permissões",
      settings: "Configurações",
      profile: "Meu perfil"
    };

    const eyebrows = {
      dashboard: "Control center",
      whatsapp: "Operação em tempo real",
      crm: "Relacionamento comercial",
      pipeline: "Pipeline de receita",
      users: "Governança",
      settings: "Administração",
      profile: "Conta"
    };

    $("#viewTitle").textContent = titles[view] || "Atlas One";
    $("#topEyebrow").textContent = eyebrows[view] || "Atlas One";
    render();
  }

  function handleGlobalSearch() {
    const query = ($("#globalSearch")?.value || "").trim();

    if (currentView === "whatsapp") {
      $("#conversationSearch").value = query;
      renderConversations();
      return;
    }

    if (currentView === "crm") {
      $("#leadSearch").value = query;
      renderCRM();
      return;
    }

    if (query) {
      setView("crm");
      $("#leadSearch").value = query;
      renderCRM();
    }
  }

  function render() {
    if (!state.me) return;
    $("#workspaceName").textContent = state.settings.workspaceName || "Operação Comercial";
    $("#meName").textContent = state.me.name;
    $("#meRole").textContent = state.me.role;
    $("#deliveryBadge").textContent = "WhatsApp real";
    $$(".admin-only").forEach(item => item.style.display = isManager(state.me) ? "" : "none");

    renderDashboard();
    renderConversations();
    renderCRM();
    renderPipeline();
    renderUsers();
    renderSettings();
    renderProfile();
    renderModalSelects();
    renderLeadDetail();
  }

  function renderDashboard() {
    const totalLeads = state.leads.length;
    const openConversations = state.conversations.filter(item => item.status !== "Resolvido").length;
    const resolvedConversations = state.conversations.filter(item => item.status === "Resolvido").length;
    const proposals = state.leads.filter(item => item.status === "Proposta enviada").length;
    const meetings = state.leads.filter(item => item.status === "Reunião marcada").length;
    const closed = state.leads.filter(item => item.status === "Fechado").length;
    const lost = state.leads.filter(item => item.status === "Perdido").length;
    const conversionRate = closed + lost ? Math.round((closed / (closed + lost)) * 100) : 0;
    const estimatedRevenue = state.leads
      .filter(item => !["Perdido"].includes(item.status))
      .reduce((total, lead) => total + Number(lead.value || 0), 0);

    const metrics = [
      { label: "Leads totais", value: totalLeads, note: `${money(estimatedRevenue)} em receita potencial` },
      { label: "Conversas abertas", value: openConversations, note: `${resolvedConversations} resolvidas no histórico` },
      { label: "Taxa de conversão", value: `${conversionRate}%`, note: `${closed} vendas fechadas` },
      { label: "Propostas e reuniões", value: proposals + meetings, note: `${proposals} propostas · ${meetings} reuniões` }
    ];

    $("#metricGrid").innerHTML = metrics.map((metric, index) => `
      <article class="metric-card">
        <div class="metric-label">
          <span>${escapeHtml(metric.label)}</span>
          <i aria-hidden="true">${escapeHtml(String(index + 1).padStart(2, "0"))}</i>
        </div>
        <strong>${escapeHtml(metric.value)}</strong>
        <small>${escapeHtml(metric.note)}</small>
      </article>
    `).join("");

    renderPipelineBars();
    renderPerformance();
    renderChannels();
    renderActivity();
  }

  function renderPipelineBars() {
    const stages = funnelStages();
    const totals = stages.map(stage => ({
      stage,
      count: state.leads.filter(lead => lead.status === stage).length,
      value: state.leads.filter(lead => lead.status === stage).reduce((sum, lead) => sum + Number(lead.value || 0), 0)
    }));
    const max = Math.max(...totals.map(item => item.value), 1);
    const overall = totals.reduce((sum, item) => sum + item.value, 0);

    $("#pipelineTotal").textContent = money(overall);
    $("#pipelineBars").innerHTML = totals.map(item => `
      <div class="bar-row">
        <strong>${escapeHtml(item.stage)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Math.round((item.value / max) * 100))}%"></div></div>
        <span class="soft-pill">${escapeHtml(money(item.value))}</span>
      </div>
    `).join("");
  }

  function renderPerformance() {
    const maxResolved = Math.max(...state.users.map(user => Number(user.productivity?.resolvedToday || 0)), 1);

    $("#performanceList").innerHTML = state.users.map(user => {
      const assigned = state.conversations.filter(conversation => conversation.assignedTo === user.id && conversation.status !== "Resolvido").length;
      const resolved = Number(user.productivity?.resolvedToday || 0);
      return `
        <div class="stack-row">
          <div class="stack-row-head">
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <div class="muted">${escapeHtml(user.role)} · ${assigned} conversas ativas</div>
            </div>
            <span class="status-pill ${user.online ? "status-aberto" : "status-resolvido"}">${user.online ? "Online" : "Offline"}</span>
          </div>
          <div class="progress-line"><span style="width:${Math.round((resolved / maxResolved) * 100)}%"></span></div>
          <div class="muted">${resolved} resoluções · ${user.productivity?.averageResponseMinutes || 0} min resposta média · ${user.productivity?.conversionRate || 0}% conversão</div>
        </div>
      `;
    }).join("");
  }

  function renderChannels() {
    $("#channelList").innerHTML = state.instances.map(instance => {
      const conversations = state.conversations.filter(conversation => conversation.instance === instance.name);
      const open = conversations.filter(conversation => conversation.status !== "Resolvido").length;
      return `
        <div class="stack-row">
          <div class="stack-row-head">
            <div>
              <strong>${escapeHtml(instance.label)}</strong>
              <div class="muted">${formatPhone(instance.phone)} · ${escapeHtml(instance.ownerTeam || "Comercial")}</div>
            </div>
            <span class="status-pill status-resolvido">${escapeHtml(instance.status)}</span>
          </div>
          <div class="muted">${conversations.length} conversas · ${open} abertas</div>
        </div>
      `;
    }).join("") || emptyState("Nenhum número cadastrado.");
  }

  function renderActivity() {
    $("#activityList").innerHTML = state.activity.slice(0, 6).map(item => `
      <div class="activity-item">
        <div class="stack-row-head">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="soft-pill">${escapeHtml(item.type)}</span>
        </div>
        <p class="muted">${escapeHtml(item.description)}</p>
        <small class="muted">${formatDateTime(item.createdAt)} · ${escapeHtml(userName(item.userId))}</small>
      </div>
    `).join("") || emptyState("A timeline será preenchida conforme a operação avançar.");
  }

  function renderConversations() {
    renderConversationFilters();
    const conversations = getFilteredConversations();
    $("#conversationCount").textContent = String(conversations.length);

    if (!activeConversationId || !state.conversations.some(item => item.id === activeConversationId)) {
      activeConversationId = conversations[0]?.id || sortedConversations(state.conversations)[0]?.id || null;
    }

    $("#conversationList").innerHTML = conversations.map(conversationCard).join("") || emptyState("Nenhuma conversa encontrada.");
    renderActiveConversation();
  }

  function renderConversationFilters() {
    setSelectOptions("#conversationOwnerFilter", [
      { value: "all", label: "Todos os atendentes" },
      { value: "none", label: "Fila geral" },
      ...state.users.map(user => ({ value: user.id, label: user.name }))
    ]);

    setSelectOptions("#conversationInstanceFilter", [
      { value: "all", label: "Todos os números" },
      ...state.instances.map(instance => ({ value: instance.name, label: instance.label }))
    ]);

    setSelectOptions("#conversationStatusFilter", [
      { value: "all", label: "Todos os status" },
      ...conversationStatuses.map(status => ({ value: status, label: status }))
    ]);
  }

  function getFilteredConversations() {
    const search = ($("#conversationSearch").value || "").toLowerCase().trim();
    const owner = $("#conversationOwnerFilter").value || "all";
    const instance = $("#conversationInstanceFilter").value || "all";
    const status = $("#conversationStatusFilter").value || "all";

    return sortedConversations(state.conversations).filter(conversation => {
      const haystack = [
        conversation.customerName,
        conversation.company,
        conversation.customerPhone,
        conversation.status,
        conversation.priority,
        userName(conversation.assignedTo),
        instanceLabel(conversation.instance),
        ...(conversation.tags || [])
      ].join(" ").toLowerCase();

      if (search && !haystack.includes(search)) return false;
      if (owner !== "all" && (owner === "none" ? conversation.assignedTo : conversation.assignedTo !== owner)) return false;
      if (instance !== "all" && conversation.instance !== instance) return false;
      if (status !== "all" && conversation.status !== status) return false;
      return true;
    });
  }

  function conversationCard(conversation) {
    const lastMessage = conversationLastMessage(conversation.id);
    const active = conversation.id === activeConversationId ? "active" : "";
    const tags = (conversation.tags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    const avatar = contactAvatar(conversation, 96);

    return `
      <article class="conversation-card ${active}">
        <button type="button" data-conversation-id="${escapeHtml(conversation.id)}">
          <div class="conversation-person">
            <img class="contact-photo list" src="${avatar}" alt="" />
            <div class="conversation-person-body">
          <div class="conversation-card-head">
            <strong>${escapeHtml(conversation.customerName)}</strong>
            <span class="status-pill ${statusClass(conversation.status)}">${escapeHtml(conversation.status)}</span>
          </div>
              <small>${escapeHtml(formatPhone(conversation.customerPhone))} · ${escapeHtml(formatShortDate(lastMessage?.createdAt || conversation.updatedAt))}</small>
            </div>
          </div>
          <p>${escapeHtml(conversation.company || "Sem empresa")} · ${escapeHtml(userName(conversation.assignedTo))}</p>
          <p>${escapeHtml(lastMessage?.text || "Sem mensagens no histórico")}</p>
          <div class="chip-row">
            <span class="priority ${priorityClass(conversation.priority)}">${escapeHtml(conversation.priority || "Normal")}</span>
            <span class="soft-pill">${escapeHtml(formatShortDate(lastMessage?.createdAt || conversation.updatedAt))}</span>
          </div>
          <div class="tag-row">${tags}</div>
        </button>
      </article>
    `;
  }

  function renderActiveConversation() {
    const conversation = state.conversations.find(item => item.id === activeConversationId);
    const disabled = !conversation;

    $("#replyText").disabled = disabled;
    $("#sendMessageButton").disabled = disabled;
    $("#createLeadButton").disabled = disabled;
    $("#saveConversationButton").disabled = disabled;

    if (!conversation) {
      $("#activeAvatar").src = contactAvatar({ customerName: "Atlas One", customerPhone: "" }, 128);
      $("#activeName").textContent = "Selecione uma conversa";
      $("#activeMeta").textContent = "Nenhum atendimento selecionado";
      $("#sideContactAvatar").src = contactAvatar({ customerName: "Atlas One", customerPhone: "" }, 128);
      $("#sideContactName").textContent = "Selecione uma conversa";
      $("#sideContactPhone").textContent = "Nenhum contato ativo";
      $("#messageList").innerHTML = emptyState("Selecione uma conversa para visualizar o histórico.");
      $("#conversationHistory").innerHTML = emptyState("Sem histórico.");
      return;
    }

    $("#activeAvatar").src = contactAvatar(conversation, 128);
    $("#activeName").textContent = conversation.customerName;
    $("#sideContactAvatar").src = contactAvatar(conversation, 128);
    $("#sideContactName").textContent = conversation.customerName;
    $("#sideContactPhone").textContent = `${formatPhone(conversation.customerPhone)} · ${conversation.company || "Sem empresa"}`;
    $("#activeMeta").textContent = `${formatPhone(conversation.customerPhone)} · ${instanceLabel(conversation.instance)}`;

    const messages = state.messages
      .filter(message => message.conversationId === conversation.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    $("#messageList").innerHTML = messages.map(message => `
      <article class="message ${message.direction === "out" ? "out" : "in"}">
        <p>${escapeHtml(message.text)}</p>
        <small>${message.direction === "out" ? escapeHtml(userName(message.userId)) : "Cliente"} · ${formatDateTime(message.createdAt)} · ${escapeHtml(message.delivery || "Local")}</small>
      </article>
    `).join("") || emptyState("Ainda não há mensagens nesta conversa.");

    requestAnimationFrame(() => {
      const messageList = $("#messageList");
      messageList.scrollTop = messageList.scrollHeight;
    });

    setSelectOptions("#sideStatus", conversationStatuses.map(status => ({ value: status, label: status })), conversation.status);
    setSelectOptions("#sideOwner", ownerOptions(), conversation.assignedTo || "");
    $("#sidePriority").value = conversation.priority || "Normal";
    $("#sideCompany").value = conversation.company || "";
    $("#sideNote").value = conversation.notes || "";
    $("#sideTags").innerHTML = settingsTags().map(tag => `
      <label class="tag-check">
        <input type="checkbox" value="${escapeHtml(tag)}" ${conversation.tags?.includes(tag) ? "checked" : ""} />
        ${escapeHtml(tag)}
      </label>
    `).join("");

    $("#conversationHistory").innerHTML = (conversation.history || []).slice(0, 6).map(item => `
      <div class="timeline-item">
        <strong>${formatShortDate(item.createdAt)}</strong>
        <div>${escapeHtml(item.description)}</div>
        <small>${escapeHtml(userName(item.userId))}</small>
      </div>
    `).join("") || emptyState("Sem alterações registradas.");
  }

  async function sendMessage() {
    const conversation = activeConversation();
    const text = $("#replyText").value.trim();
    if (!conversation || !text) return;

    $("#sendMessageButton").disabled = true;
    try {
      const message = await api(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text })
      });
      $("#replyText").value = "";
      showToast(message.delivery === "Evolution API" ? "Mensagem enviada pela Evolution API." : "Mensagem registrada localmente.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    } finally {
      $("#sendMessageButton").disabled = false;
    }
  }

  async function saveConversationPanel() {
    const conversation = activeConversation();
    if (!conversation) return;

    const tags = $$("#sideTags input:checked").map(input => input.value);

    try {
      await api(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          company: $("#sideCompany").value,
          status: $("#sideStatus").value,
          assignedTo: $("#sideOwner").value,
          priority: $("#sidePriority").value,
          tags,
          notes: $("#sideNote").value
        })
      });
      showToast("Atendimento atualizado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function updateConversationStatus(status) {
    const conversation = activeConversation();
    if (!conversation) return;

    try {
      await api(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      showToast(`Conversa marcada como ${status.toLowerCase()}.`);
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function createLeadFromConversation() {
    const conversation = activeConversation();
    if (!conversation) return;

    try {
      await api(`/api/conversations/${conversation.id}/lead`, { method: "POST" });
      showToast("Lead associado ao CRM.");
      await bootstrap();
      setView("crm");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function createConversation(event) {
    event.preventDefault();

    try {
      const conversation = await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          customerName: $("#newConversationName").value,
          customerPhone: $("#newConversationPhone").value,
          company: $("#newConversationCompany").value,
          instance: $("#newConversationInstance").value
        })
      });
      activeConversationId = conversation.id;
      closeModal("conversationModal");
      event.target.reset();
      showToast("Conversa criada.");
      await bootstrap();
      setView("whatsapp");
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderCRM() {
    renderLeadFilters();

    const search = ($("#leadSearch").value || "").toLowerCase().trim();
    const stage = $("#leadStageFilter").value || "all";
    const owner = $("#leadOwnerFilter").value || "all";
    const leads = state.leads.filter(lead => {
      const haystack = [lead.company, lead.contact, lead.phone, lead.email, lead.origin, lead.status, userName(lead.assignedTo)].join(" ").toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (stage !== "all" && lead.status !== stage) return false;
      if (owner !== "all" && (owner === "none" ? lead.assignedTo : lead.assignedTo !== owner)) return false;
      return true;
    });

    $("#leadCount").textContent = `${leads.length} registros`;
    $("#leadRows").innerHTML = leads.map(lead => `
      <tr>
        <td>
          <div class="lead-main">
            <strong>${escapeHtml(lead.company)}</strong>
            <small>${escapeHtml(lead.notes || "Sem observações")}</small>
          </div>
        </td>
        <td class="lead-contact">
          ${escapeHtml(lead.contact)}
          <small>${formatPhone(lead.phone)} · ${escapeHtml(lead.email || "sem e-mail")}</small>
        </td>
        <td>${escapeHtml(lead.origin || "Manual")}</td>
        <td>
          <select class="field inline-select" data-lead-stage="${escapeHtml(lead.id)}">
            ${stageOptions(lead.status)}
          </select>
        </td>
        <td>${escapeHtml(userName(lead.assignedTo))}</td>
        <td>${money(lead.value)}</td>
        <td>${escapeHtml(formatFollowUp(lead.nextFollowUp))}</td>
        <td><button class="button ghost compact-button" type="button" data-lead-open="${escapeHtml(lead.id)}">Abrir ficha</button></td>
      </tr>
    `).join("") || `<tr><td colspan="8">${emptyState("Nenhum lead encontrado.")}</td></tr>`;
  }

  function renderLeadFilters() {
    setSelectOptions("#leadStageFilter", [
      { value: "all", label: "Todas as etapas" },
      ...funnelStages().map(stage => ({ value: stage, label: stage }))
    ]);

    setSelectOptions("#leadOwnerFilter", [
      { value: "all", label: "Todos os responsáveis" },
      { value: "none", label: "Sem responsável" },
      ...state.users.map(user => ({ value: user.id, label: user.name }))
    ]);
  }

  async function createLead(event) {
    event.preventDefault();

    try {
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          company: $("#leadCompany").value,
          contact: $("#leadContact").value,
          phone: $("#leadPhone").value,
          email: $("#leadEmail").value,
          origin: $("#leadOrigin").value,
          assignedTo: $("#leadOwner").value,
          status: $("#leadStage").value,
          temperature: $("#leadTemperature").value,
          value: $("#leadValue").value,
          nextFollowUp: $("#leadFollowUp").value,
          notes: $("#leadNotes").value
        })
      });
      closeModal("leadModal");
      event.target.reset();
      showToast("Lead cadastrado no CRM.");
      await bootstrap();
      setView("crm");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function updateLead(id, patch) {
    try {
      await api(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      showToast("Lead atualizado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function openLeadDetail(id) {
    activeLeadId = id;
    openModal("leadDetailModal");
    renderLeadDetail();
  }

  function activeLead() {
    return state.leads.find(lead => lead.id === activeLeadId);
  }

  function renderLeadDetail() {
    const modal = $("#leadDetailModal");
    if (!modal || !modal.classList.contains("open")) return;

    const lead = activeLead();
    if (!lead) {
      $("#detailLeadTitle").textContent = "Lead não encontrado";
      return;
    }

    $("#detailLeadTitle").textContent = `${lead.company} · ${lead.contact}`;
    $("#detailCompany").value = lead.company || "";
    $("#detailContact").value = lead.contact || "";
    $("#detailPhone").value = lead.phone || "";
    $("#detailEmail").value = lead.email || "";
    $("#detailOrigin").value = lead.origin || "";
    $("#detailValue").value = Number(lead.value || 0);
    $("#detailFollowUp").value = lead.nextFollowUp || "";
    $("#detailNotes").value = lead.notes || "";
    setSelectOptions("#detailOwner", ownerOptions(), lead.assignedTo || "");
    setSelectOptions("#detailStage", funnelStages().map(stage => ({ value: stage, label: stage })), lead.status);
    $("#detailTemperature").value = lead.temperature || "Morno";

    const conversation = leadConversation(lead);
    $("#detailConversationStatus").textContent = conversation
      ? `Conversa vinculada · ${conversation.status}`
      : "Sem conversa vinculada";
    $("#detailConversationMeta").textContent = conversation
      ? `${conversation.customerName} · ${formatPhone(conversation.customerPhone)} · ${instanceLabel(conversation.instance)}`
      : "Crie uma conversa para registrar mensagens no histórico e responder pelo WhatsApp.";
    $("#detailOpenConversation").disabled = false;
    $("#detailCreateConversation").disabled = Boolean(conversation);

    $("#detailLeadHistory").innerHTML = (lead.history || []).slice(0, 8).map(item => `
      <div class="timeline-item">
        <strong>${formatShortDate(item.createdAt)}</strong>
        <div>${escapeHtml(item.description)}</div>
        <small>${escapeHtml(userName(item.userId))}</small>
      </div>
    `).join("") || emptyState("Sem histórico registrado.");
  }

  async function saveLeadDetail(event) {
    event.preventDefault();
    const lead = activeLead();
    if (!lead) return showToast("Selecione um lead para editar.");

    try {
      await api(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          company: $("#detailCompany").value,
          contact: $("#detailContact").value,
          phone: $("#detailPhone").value,
          email: $("#detailEmail").value,
          origin: $("#detailOrigin").value,
          assignedTo: $("#detailOwner").value,
          status: $("#detailStage").value,
          temperature: $("#detailTemperature").value,
          value: $("#detailValue").value,
          nextFollowUp: $("#detailFollowUp").value,
          notes: $("#detailNotes").value
        })
      });
      showToast("Ficha do lead atualizada.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function leadConversation(lead) {
    if (!lead) return null;
    return state.conversations.find(conversation => conversation.id === lead.conversationId)
      || state.conversations.find(conversation => normalizePhone(conversation.customerPhone) === normalizePhone(lead.phone));
  }

  async function ensureLeadConversation(showSuccess = false) {
    const lead = activeLead();
    if (!lead) {
      showToast("Selecione um lead primeiro.");
      return null;
    }

    let conversation = leadConversation(lead);
    if (conversation) {
      if (!lead.conversationId || lead.conversationId !== conversation.id) {
        await api(`/api/leads/${lead.id}`, {
          method: "PATCH",
          body: JSON.stringify({ conversationId: conversation.id })
        });
        lead.conversationId = conversation.id;
      }
      if (showSuccess) showToast("Conversa já vinculada ao lead.");
      return conversation;
    }

    if (!normalizePhone(lead.phone)) {
      showToast("Este lead não tem WhatsApp válido.");
      return null;
    }

    conversation = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        customerName: lead.contact,
        customerPhone: lead.phone,
        company: lead.company,
        instance: state.settings.defaultInstance || state.instances[0]?.name || "",
        assignedTo: lead.assignedTo || state.me?.id,
        tags: ["crm", "whatsapp"]
      })
    });

    await api(`/api/leads/${lead.id}`, {
      method: "PATCH",
      body: JSON.stringify({ conversationId: conversation.id })
    });

    activeConversationId = conversation.id;
    if (showSuccess) showToast("Conversa WhatsApp criada e vinculada.");
    await bootstrap();
    return conversation;
  }

  async function openLeadConversation() {
    try {
      const conversation = await ensureLeadConversation(false);
      if (!conversation) return;
      activeConversationId = conversation.id;
      closeModal("leadDetailModal");
      await bootstrap();
      setView("whatsapp");
      showToast("Conversa aberta no WhatsApp Inbox.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function sendLeadMessage() {
    const text = $("#detailMessage").value.trim();
    if (!text) return showToast("Digite a mensagem antes de enviar.");

    try {
      const conversation = await ensureLeadConversation(false);
      if (!conversation) return;
      const message = await api(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text })
      });
      $("#detailMessage").value = "";
      activeConversationId = conversation.id;
      showToast(message.delivery === "Evolution API" ? "Mensagem enviada pela Evolution API." : "Mensagem registrada localmente.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderPipeline() {
    const stages = funnelStages();
    $("#pipelineSummary").textContent = `${state.leads.length} oportunidades · ${money(state.leads.reduce((sum, lead) => sum + Number(lead.value || 0), 0))}`;

    $("#kanban").innerHTML = stages.map(stage => {
      const leads = state.leads.filter(lead => lead.status === stage);
      const total = leads.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
      return `
        <section class="stage-column" data-stage="${escapeHtml(stage)}">
          <div class="stage-head">
            <div class="stage-head-top">
              <strong>${escapeHtml(stage)}</strong>
              <span class="soft-pill">${leads.length}</span>
            </div>
            <span class="muted">${money(total)}</span>
          </div>
          ${leads.map(lead => `
            <article class="deal-card" draggable="true" data-lead-card="${escapeHtml(lead.id)}">
              <strong>${escapeHtml(lead.company)}</strong>
              <p>${escapeHtml(lead.contact)} · ${escapeHtml(userName(lead.assignedTo))}</p>
              <div class="chip-row">
                <span class="temperature ${temperatureClass(lead.temperature)}">${escapeHtml(lead.temperature)}</span>
                <span class="soft-pill">${money(lead.value)}</span>
              </div>
              <p>Follow-up: ${escapeHtml(formatFollowUp(lead.nextFollowUp))}</p>
            </article>
          `).join("")}
        </section>
      `;
    }).join("");
  }

  function renderUsers() {
    $("#userGrid").innerHTML = state.users.map(user => {
      const assignedConversations = state.conversations.filter(conversation => conversation.assignedTo === user.id && conversation.status !== "Resolvido").length;
      const assignedLeads = state.leads.filter(lead => lead.assignedTo === user.id && !["Fechado", "Perdido"].includes(lead.status)).length;
      const nextStatus = user.status === "Aprovado" ? "Bloqueado" : "Aprovado";

      return `
        <article class="user-card">
          <div class="user-card-head">
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <p>${escapeHtml(user.email)}</p>
            </div>
            <span class="status-pill ${user.online ? "status-aberto" : "status-resolvido"}">${user.online ? "Online" : "Offline"}</span>
          </div>
          <div class="chip-row">
            <span class="soft-pill">${escapeHtml(user.role)}</span>
            <span class="soft-pill">${escapeHtml(user.status)}</span>
          </div>
          <div class="user-stats">
            <div><strong>${assignedConversations}</strong><span>Conversas</span></div>
            <div><strong>${assignedLeads}</strong><span>Leads ativos</span></div>
            <div><strong>${user.productivity?.conversionRate || 0}%</strong><span>Conversão</span></div>
          </div>
          ${user.id !== state.me.id ? `<button class="button ghost" type="button" data-toggle-user="${escapeHtml(user.id)}" data-next-status="${escapeHtml(nextStatus)}">${nextStatus === "Aprovado" ? "Aprovar usuário" : "Bloquear usuário"}</button>` : ""}
        </article>
      `;
    }).join("");
  }

  async function createUser(event) {
    event.preventDefault();

    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: $("#newUserName").value,
          email: $("#newUserEmail").value,
          password: $("#newUserPassword").value || "123456",
          role: $("#newUserRole").value
        })
      });
      event.target.reset();
      $("#newUserPassword").value = "123456";
      showToast("Usuário criado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function toggleUser(id, status) {
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      showToast("Usuário atualizado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderSettings() {
    $("#settingsCompany").value = state.settings.companyName || "";
    $("#settingsWorkspace").value = state.settings.workspaceName || "";
    $("#settingsEvolutionUrl").value = state.settings.evolutionUrl || "";
    $("#settingsEvolutionKey").value = state.settings.evolutionApiKey || "";
    $("#settingsDeliveryMode").value = "Evolution API";
    $("#settingsDefaultInstance").value = state.settings.defaultInstance || "";
    $("#settingsTags").value = settingsTags().join(", ");
    $("#settingsStages").value = funnelStages().join("\n");

    $("#instanceList").innerHTML = state.instances.map(instance => `
      <div class="stack-row">
        <div class="stack-row-head">
          <div>
            <strong>${escapeHtml(instance.label)}</strong>
            <div class="muted">${escapeHtml(instance.name)} · ${formatPhone(instance.phone)} · ${escapeHtml(instance.ownerTeam || "Comercial")}</div>
            <div class="muted">Última sincronização: ${escapeHtml(formatDateTime(instance.lastSync))}</div>
          </div>
          <span class="status-pill ${instanceStatusClass(instance.status)}">${escapeHtml(instance.status)}</span>
        </div>
        <div class="chip-row">
          <button class="button subtle" type="button" data-instance-connect="${escapeHtml(instance.name)}">Conectar / QR</button>
          <button class="button ghost" type="button" data-instance-check="${escapeHtml(instance.name)}">Verificar</button>
          <button class="button ghost" type="button" data-instance-sync="${escapeHtml(instance.name)}">Sincronizar</button>
          <button class="button ghost" type="button" data-instance-disconnect="${escapeHtml(instance.name)}">Desconectar</button>
        </div>
      </div>
    `).join("") || emptyState("Nenhum número cadastrado.");
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          companyName: $("#settingsCompany").value,
          workspaceName: $("#settingsWorkspace").value,
          evolutionUrl: $("#settingsEvolutionUrl").value,
          evolutionApiKey: $("#settingsEvolutionKey").value,
          deliveryMode: $("#settingsDeliveryMode").value,
          defaultInstance: $("#settingsDefaultInstance").value,
          tags: $("#settingsTags").value,
          funnelStages: $("#settingsStages").value
        })
      });
      showToast("Configurações salvas.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function createInstance(event) {
    event.preventDefault();

    try {
      const instance = await api("/api/instances", {
        method: "POST",
        body: JSON.stringify({
          name: $("#instanceName").value,
          label: $("#instanceLabel").value,
          phone: $("#instancePhone").value,
          ownerTeam: $("#instanceTeam").value
        })
      });
      $("#settingsDefaultInstance").value = instance.name;
      showInstanceResult(instance);
      showToast("Número adicionado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function connectInstance(name) {
    const instanceName = String(name || "").trim();
    if (!instanceName) return showToast("Informe o nome da instância.");

    try {
      openModal("instanceModal");
      $("#instanceName").value = instanceName;
      const data = await api(`/api/instances/${encodeURIComponent(instanceName)}/connect`);
      showInstanceResult(data);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function checkInstance(name) {
    const instanceName = String(name || "").trim();
    if (!instanceName) return showToast("Informe o nome da instância.");

    try {
      openModal("instanceModal");
      $("#instanceName").value = instanceName;
      const data = await api(`/api/instances/${encodeURIComponent(instanceName)}/state`);
      showInstanceResult(data);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function syncInstance(name) {
    const instanceName = String(name || "").trim();
    if (!instanceName) return showToast("Informe o nome da instância.");

    try {
      const data = await api(`/api/instances/${encodeURIComponent(instanceName)}/sync`, { method: "POST" });
      showToast(data.importedConversations
        ? `${data.importedConversations} conversas carregadas.`
        : "Número sincronizado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function disconnectInstance(name) {
    const instanceName = String(name || "").trim();
    if (!instanceName) return showToast("Informe o nome da instância.");

    try {
      await api(`/api/instances/${encodeURIComponent(instanceName)}/disconnect`, { method: "POST" });
      showToast("Número desconectado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function showInstanceResult(data) {
    $("#instanceResult").innerHTML = `
      ${data.qrImage ? `<img class="qr-image" src="${escapeHtml(data.qrImage)}" alt="QR Code" />` : ""}
      <div class="stack-row">
        <strong>${escapeHtml(data.status || data.state || data.mode || "Retorno do canal")}</strong>
        <div class="muted">Código: ${escapeHtml(data.pairingCode || "-")}</div>
        ${data.warning ? `<div class="muted">${escapeHtml(data.warning)}</div>` : ""}
        ${data.lastSync ? `<div class="muted">Última sincronização: ${escapeHtml(formatDateTime(data.lastSync))}</div>` : ""}
      </div>
      <pre class="stack-row">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    `;
  }

  function renderProfile() {
    $("#profileName").value = state.me.name || "";
    $("#profileEmail").value = state.me.email || "";
  }

  async function saveProfile(event) {
    event.preventDefault();

    const payload = {
      name: $("#profileName").value,
      email: $("#profileEmail").value
    };

    if ($("#profilePassword").value) {
      payload.newPassword = $("#profilePassword").value;
      payload.currentPassword = prompt("Digite sua senha atual:");
      if (!payload.currentPassword) return;
    }

    try {
      const user = await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      state.me = user;
      localStorage.setItem("atlas_user", JSON.stringify(user));
      $("#profilePassword").value = "";
      showToast("Perfil atualizado.");
      await bootstrap();
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderModalSelects() {
    setSelectOptions("#newConversationInstance", state.instances.map(instance => ({ value: instance.name, label: instance.label })), state.settings.defaultInstance);
    setSelectOptions("#leadOwner", ownerOptions(), state.me?.id || "");
    setSelectOptions("#leadStage", funnelStages().map(stage => ({ value: stage, label: stage })), funnelStages()[0]);
  }

  function openModal(id) {
    if (id === "conversationModal") {
      renderModalSelects();
      $("#newConversationInstance").value = state.settings.defaultInstance || state.instances[0]?.name || "";
    }

    if (id === "leadModal") {
      renderModalSelects();
      $("#leadStage").value = funnelStages()[0];
      $("#leadOwner").value = state.me?.id || "";
    }

    if (id === "instanceModal") {
      $("#instanceName").value = state.settings.defaultInstance || "atlas-one-novo";
      $("#instanceResult").innerHTML = "";
    }

    const modal = $(`#${id}`);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const modal = $(`#${id}`);
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function activeConversation() {
    return state.conversations.find(item => item.id === activeConversationId);
  }

  function sortedConversations(conversations) {
    return [...conversations].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function conversationLastMessage(conversationId) {
    return state.messages
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .at(-1);
  }

  function ownerOptions() {
    return [
      { value: "", label: "Fila geral" },
      ...state.users.filter(user => user.status === "Aprovado").map(user => ({ value: user.id, label: `${user.name} · ${user.role}` }))
    ];
  }

  function setSelectOptions(selector, items, selected) {
    const element = typeof selector === "string" ? $(selector) : selector;
    if (!element) return;

    const current = selected !== undefined ? selected : element.value;
    element.innerHTML = items.map(item => `
      <option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>
    `).join("");

    if (items.some(item => String(item.value) === String(current))) {
      element.value = current;
    } else if (items.length) {
      element.value = items[0].value;
    }
  }

  function stageOptions(selected) {
    return funnelStages().map(stage => `
      <option value="${escapeHtml(stage)}" ${stage === selected ? "selected" : ""}>${escapeHtml(stage)}</option>
    `).join("");
  }

  function funnelStages() {
    return Array.isArray(state.settings.funnelStages) && state.settings.funnelStages.length
      ? state.settings.funnelStages
      : defaultStages;
  }

  function settingsTags() {
    return Array.isArray(state.settings.tags) && state.settings.tags.length
      ? state.settings.tags
      : ["enterprise", "whatsapp", "proposta", "prioridade"];
  }

  function isManager(user) {
    return ["Admin", "Supervisor", "Gerente"].includes(user?.role);
  }

  function userName(id) {
    if (!id) return "Fila geral";
    if (id === "system") return "Sistema";
    return state.users.find(user => user.id === id)?.name || "Equipe";
  }

  function instanceLabel(name) {
    return state.instances.find(instance => instance.name === name)?.label || name || "Sem canal";
  }

  function statusClass(status) {
    return {
      "Aberto": "status-aberto",
      "Pendente": "status-pendente",
      "Resolvido": "status-resolvido",
      "Aguardando cliente": "status-aguardando"
    }[status] || "status-pendente";
  }

  function priorityClass(priority) {
    return {
      "Alta": "priority-alta",
      "Normal": "priority-normal",
      "Baixa": "priority-baixa"
    }[priority] || "priority-normal";
  }

  function temperatureClass(temperature) {
    return {
      "Quente": "temperature-quente",
      "Morno": "temperature-morno",
      "Frio": "temperature-frio"
    }[temperature] || "temperature-morno";
  }

  function instanceStatusClass(status) {
    return {
      "Conectado": "status-aberto",
      "Aguardando QR": "status-aguardando",
      "Desconectado": "status-resolvido",
      "Falha": "priority-alta"
    }[status] || "status-resolvido";
  }

  function contactAvatar(conversation, size = 96) {
    if (conversation?.avatarUrl) return conversation.avatarUrl;

    const name = String(conversation?.customerName || "Atlas One").trim() || "Contato";
    const seedSource = normalizePhone(conversation?.customerPhone || "") || name;
    const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const palettes = [
      ["#e7f1ff", "#2d74f8", "#9ac8ff"],
      ["#f0f7ff", "#4f8df7", "#d8ecff"],
      ["#edf4ff", "#1f5fd7", "#75b7ff"],
      ["#f5f8ff", "#5c7cff", "#b8ccff"],
      ["#effaf7", "#10a67a", "#bdf1df"]
    ];
    const [base, accent, glow] = palettes[seed % palettes.length];
    const safeInitials = escapeHtml(initials(name));
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${base}"/>
            <stop offset="0.62" stop-color="${glow}"/>
            <stop offset="1" stop-color="${accent}"/>
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="${Math.round(size / 2)}" fill="url(#g)"/>
        <circle cx="${Math.round(size * 0.34)}" cy="${Math.round(size * 0.3)}" r="${Math.round(size * 0.18)}" fill="rgba(255,255,255,.62)"/>
        <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(size * 0.3)}" font-weight="760" fill="white">${safeInitials}</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function initials(name) {
    const parts = String(name || "A1").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "A1";
    return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function money(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "Sem telefone";
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return `+${digits}`;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatFollowUp(value) {
    if (!value) return "Sem follow-up";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function emptyState(text) {
    return `<div class="stack-row muted">${escapeHtml(text)}</div>`;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
})();
