"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  CornerUpLeft,
  Filter,
  Keyboard,
  ListChecks,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  User,
  X
} from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@atlas-one/ui";
import {
  createConversation,
  archiveConversation,
  bulkUpdateConversations,
  hideMessage,
  editMessage,
  getConversation,
  getCompanySettings,
  listConversations,
  listInboxShortcuts,
  listInboxTags,
  listTeams,
  listUsers,
  uploadUserAvatar,
  logout as apiLogout,
  sendMediaFile,
  sendMessage,
  transcribeMessage,
  updateConversation,
  updateLead,
  type Conversation,
  type CompanySettings,
  type Message,
  type SessionUser,
  type ShortcutItem,
  type TagCatalogItem,
  type TeamRow,
  type UserRow
} from "../lib/api";
import { connectRealtime, joinTenant } from "../lib/socket";
import { QuickRepliesMenu } from "./quick-replies-menu";
import {
  conversationStatusLabel,
  INBOX_QUEUE_BUCKETS,
  INBOX_QUEUE_BUCKET_HELP,
  type LifecycleStatus
} from "../lib/product-copy";
import { TagFilterPopover } from "./conversation-tags";
import { ConversationDrawer, type ConversationDrawerTab } from "./conversation-drawer";
import { InboxBulkBar } from "./inbox-bulk-bar";
import { AppCombobox } from "./ui/app-select";
import { useAppDialogs } from "./ui/dialog-provider";
import { notify } from "../lib/notify";
import { conversationDisplayTags, mergeConversationTags } from "../lib/inbox-tags";
import { computeConversationSla, defaultInboxSlaConfig, isConversationOverSla } from "../lib/inbox-sla";
import { mergeMessages, groupMessagesForThread, sanitizeMessageForViewer } from "../lib/messages";
import { hasPermission } from "../lib/session-user";
import {
  agentDepartment,
  buildSignaturePreview,
  compressImageFile,
  CustomerAvatar,
  mediaPreviewKind,
  mediaUploadKey,
  normalizeAvatarUrl,
  normalizeWhatsAppNumber,
  profilePhotoStorageKey,
  resolveDisplayAvatar,
  roleLabel,
  statusLabel
} from "./inbox/inbox-utils";
import { MessageBubble } from "./inbox/message-bubble";
import { ConversationHeaderBar } from "./inbox/conversation-header";
import { ConversationRow } from "./inbox/conversation-row";
import { NewContactModal, UserProfileModal } from "./inbox/inbox-modals";
import { QueueSkeleton } from "./inbox/inbox-skeletons";
import { ShortcutsHelpOverlay } from "./inbox/shortcuts-help";
import {
  dispatchInboundNotification,
  getNotificationPermission,
  loadLastSeenMap,
  loadNotificationPrefs,
  persistLastSeenMap,
  requestInboxNotificationPermission,
  saveNotificationPrefs,
  type InboxNotificationPrefs
} from "../lib/inbox-notifications";

type Props = { token: string; user: SessionUser };

const INBOX_PANEL_CLASS = "overflow-hidden rounded-atlas-lg";

export function AtlasApp({ token, user }: Props) {
  const { confirm, prompt } = useAppDialogs();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [draft, setDraft] = useState("");
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [shortcutMenuOpen, setShortcutMenuOpen] = useState(false);
  const [tagCatalog, setTagCatalog] = useState<TagCatalogItem[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagsSaving, setTagsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadUrl, setPendingUploadUrl] = useState("");
  const [pendingUploadCaption, setPendingUploadCaption] = useState("");
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [newContactModalOpen, setNewContactModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<ConversationDrawerTab>("cliente");
  const [contactDraft, setContactDraft] = useState({ customerName: "", customerPhone: "" });
  const [cadenceDraft, setCadenceDraft] = useState("padrao");
  const [transferLoading, setTransferLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [internalPhoto, setInternalPhoto] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [lastSeenByConversation, setLastSeenByConversation] = useState<Record<string, number>>(() =>
    loadLastSeenMap(user.tenantId, user.id)
  );
  const [notificationPrefs, setNotificationPrefs] = useState<InboxNotificationPrefs>(() =>
    loadNotificationPrefs(user.tenantId, user.id)
  );
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");
  const [queueBucket, setQueueBucket] = useState<"active" | "history" | "all">("active");
  const [queueDepartmentId, setQueueDepartmentId] = useState<string>("all");
  const [queueOwnerId, setQueueOwnerId] = useState<string>("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>("all");
  const [queueInstanceId, setQueueInstanceId] = useState<string>("all");
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [slaTick, setSlaTick] = useState(0);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const queueScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const draftsRef = useRef<Map<string, string>>(new Map());
  const draftRef = useRef("");
  const notifyCtxRef = useRef({
    userId: user.id,
    canMonitorQueue: false,
    prefs: notificationPrefs,
    openConversation: (_id: string) => {}
  });
  const sendingTextRef = useRef(false);
  const sendingMediaRef = useRef<string | null>(null);
  const [sendingText, setSendingText] = useState(false);
  const [sendingMediaKey, setSendingMediaKey] = useState<string | null>(null);

  const selfUser = agents.find((agent) => agent.id === user.id) ?? null;

  const agentAvatarFor = useCallback(
    (agentId: string): string | null => {
      const agent = agents.find((item) => item.id === agentId);
      if (agent?.avatarUrl) return resolveDisplayAvatar(agent.avatarUrl, token) ?? null;
      const local = localStorage.getItem(profilePhotoStorageKey(user.tenantId, agentId));
      return local || null;
    },
    [agents, token, user.tenantId]
  );

  useEffect(() => {
    // Pause the SLA clock while the tab is hidden to avoid useless re-renders.
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setSlaTick((value) => value + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    // Auto-grow composer up to its CSS max-height.
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const slaConfig = useMemo(
    () =>
      defaultInboxSlaConfig({
        firstResponseMinutes: companySettings?.slaFirstResponseMinutes,
        resolutionHours: companySettings?.slaResolutionHours
      }),
    [companySettings?.slaFirstResponseMinutes, companySettings?.slaResolutionHours]
  );

  const instanceFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of conversations) {
      if (!row.instance?.id) continue;
      map.set(row.instance.id, row.instance.label || row.instance.name || "WhatsApp");
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [conversations]);

  const refreshConversations = useCallback(async () => {
    try {
      const bucket = search.trim() ? "all" : queueBucket;
      const items = await listConversations(token, bucket);
      setConversations(items);
      return items;
    } catch {
      setConversations([]);
      setError("Caixa de entrada temporariamente indisponível. Tentando reconectar...");
      return [];
    }
  }, [token, queueBucket, search]);

  const openConversation = useCallback(
    async (id: string) => {
      try {
        const detail = await getConversation(token, id);
        const previousId = activeIdRef.current;
        if (previousId && previousId !== id) {
          // Preserve unsent draft per conversation.
          draftsRef.current.set(previousId, draftRef.current);
          setDraft(draftsRef.current.get(id) ?? "");
        }
        setActiveId(id);
        setActiveConversation(detail);
        setContactDraft({
          customerName: detail.customerName ?? "",
          customerPhone: detail.customerPhone ?? ""
        });
        const cadence = (detail.lead?.customFields as { cadence?: string } | undefined)?.cadence;
        setCadenceDraft(typeof cadence === "string" && cadence ? cadence : "padrao");
        setReplyToMessage(null);
        setLastSeenByConversation((current) => ({ ...current, [id]: Date.now() }));
      } catch {
        setError("Não foi possível abrir a conversa agora.");
      }
    },
    [token]
  );

  const saveCadence = useCallback(async () => {
    if (!activeConversation?.lead?.id) return;
    try {
      await updateLead(token, activeConversation.lead.id, {
        customFields: { cadence: cadenceDraft }
      });
      setError("");
    } catch {
      setError("Não foi possível salvar cadencia");
    }
  }, [activeConversation?.lead?.id, cadenceDraft, token]);

  useEffect(() => {
    const self = agents.find((item) => item.id === user.id);
    if (self?.avatarUrl) {
      setInternalPhoto(resolveDisplayAvatar(self.avatarUrl, token) ?? null);
      return;
    }
    const saved = localStorage.getItem(profilePhotoStorageKey(user.tenantId, user.id));
    if (saved) setInternalPhoto(saved);
  }, [user.id, user.tenantId, agents, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [items, users, teamRows] = await Promise.all([
          refreshConversations(),
          listUsers(token),
          listTeams(token).catch(() => [] as TeamRow[])
        ]);
        if (!cancelled) {
          setAgents(users);
          setTeams(teamRows);
        }
        void listInboxShortcuts(token)
          .then((rows) => {
            if (!cancelled) setShortcuts(rows);
          })
          .catch(() => {
            if (!cancelled) setShortcuts([]);
          });
        void listInboxTags(token)
          .then((rows) => {
            if (!cancelled) setTagCatalog(rows);
          })
          .catch(() => {
            if (!cancelled) setTagCatalog([]);
          });
        void getCompanySettings(token)
          .then((settings) => {
            if (!cancelled) setCompanySettings(settings);
          })
          .catch(() => {
            if (!cancelled) setCompanySettings(null);
          });
        if (!cancelled && items[0] && !activeIdRef.current) await openConversation(items[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const socket = connectRealtime(token);
    joinTenant(user.tenantId, token);

    const onMessage = (payload: { conversation: Conversation; message: Message }) => {
      const viewerRole = user.role;
      const message = sanitizeMessageForViewer(payload.message, viewerRole);
      const conversation: Conversation = {
        ...payload.conversation,
        messages: (payload.conversation.messages ?? []).map((item) =>
          item.id === message.id ? message : sanitizeMessageForViewer(item, viewerRole)
        )
      };
      const ctx = notifyCtxRef.current;
      const conversationForNotify: Conversation = {
        ...conversation,
        messages: mergeMessages(conversation.messages ?? [], message)
      };
      const decision = dispatchInboundNotification({
        message,
        conversation: conversationForNotify,
        userId: ctx.userId,
        canMonitorQueue: ctx.canMonitorQueue,
        prefs: ctx.prefs,
        activeConversationId: activeIdRef.current,
        onOpenConversation: (id) => ctx.openConversation(id)
      });
      if (decision.action === "active-thread") {
      }

      setConversations((current) => {
        const others = current.filter((item) => item.id !== conversation.id);
        return [conversation, ...others].sort((a, b) => {
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bt - at;
        });
      });

      if (activeIdRef.current === conversation.id) {
        setActiveConversation((current) => {
          if (!current) return current;
          return {
            ...current,
            ...conversation,
            messages: mergeMessages(current.messages ?? [], message)
          };
        });
        setLastSeenByConversation((current) => ({ ...current, [conversation.id]: Date.now() }));
      }
    };

    socket.on("inbox:message", onMessage);
    return () => {
      cancelled = true;
      socket.off("inbox:message", onMessage);
    };
  }, [token, user.tenantId, user.role, openConversation, refreshConversations]);

  const roleIsAgent = user.role === "agent";
  const roleIsManager = user.role === "owner" || user.role === "admin" || user.role === "supervisor";
  const roleCanManageQueues = user.role === "owner" || user.role === "admin";
  const canMonitorByUser = roleCanManageQueues || hasPermission(user, "conversation:takeover");

  useEffect(() => {
    notifyCtxRef.current = {
      userId: user.id,
      canMonitorQueue: canMonitorByUser,
      prefs: notificationPrefs,
      openConversation: (id: string) => {
        void openConversation(id);
      }
    };
  }, [user.id, canMonitorByUser, notificationPrefs, openConversation]);

  useEffect(() => {
    setNotifyPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    persistLastSeenMap(user.tenantId, user.id, lastSeenByConversation);
  }, [lastSeenByConversation, user.tenantId, user.id]);

  function updateNotificationPrefs(patch: Partial<InboxNotificationPrefs>) {
    setNotificationPrefs(saveNotificationPrefs(user.tenantId, user.id, patch));
  }

  async function handleRequestNotificationPermission() {
    const permission = await requestInboxNotificationPermission();
    if (permission !== "unsupported") setNotifyPermission(permission);
  }

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of teams) map.set(team.id, team.name);
    for (const agent of agents) {
      if (agent.teamId && agent.team?.name) map.set(agent.teamId, agent.team.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.name === "Novos") return -1;
        if (b.name === "Novos") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [teams, agents]);
  const agentsByDepartment = useMemo(() => {
    if (queueDepartmentId === "all") return agents;
    return agents.filter((agent) => agent.teamId === queueDepartmentId);
  }, [agents, queueDepartmentId]);

  const activeQueueFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (queueDepartmentId !== "all") {
      const name = departmentOptions.find((item) => item.id === queueDepartmentId)?.name ?? "Departamento";
      filters.push({ key: "dept", label: name, onClear: () => setQueueDepartmentId("all") });
    }
    if (queueOwnerId === "unassigned") {
      filters.push({ key: "owner", label: "Sem atendente", onClear: () => setQueueOwnerId("all") });
    } else if (queueOwnerId !== "all") {
      const name = agents.find((item) => item.id === queueOwnerId)?.name ?? "Atendente";
      filters.push({ key: "owner", label: name, onClear: () => setQueueOwnerId("all") });
    }
    if (queueStatusFilter !== "all") {
      filters.push({
        key: "status",
        label: conversationStatusLabel(queueStatusFilter),
        onClear: () => setQueueStatusFilter("all")
      });
    }
    if (queueInstanceId !== "all") {
      const label = instanceFilterOptions.find((item) => item.id === queueInstanceId)?.label ?? "WhatsApp";
      filters.push({ key: "instance", label, onClear: () => setQueueInstanceId("all") });
    }
    return filters;
  }, [agents, departmentOptions, instanceFilterOptions, queueDepartmentId, queueInstanceId, queueOwnerId, queueStatusFilter]);

  const toggleConversationSelection = useCallback((id: string) => {
    setSelectedConversationIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }, []);

  function clearConversationSelection() {
    setSelectedConversationIds([]);
    setBulkSelectMode(false);
  }

  function mobileBackToQueue() {
    setActiveId(null);
    setActiveConversation(null);
    setDrawerOpen(false);
  }

  const mobileShowsChat = Boolean(activeId);

  useEffect(() => {
    // Lets the shell hide the mobile bottom nav while a conversation is open.
    document.body.classList.toggle("inbox-chat-open", mobileShowsChat);
    return () => document.body.classList.remove("inbox-chat-open");
  }, [mobileShowsChat]);

  const swipeStartRef = useRef<{ x: number; y: number; edge: boolean } | null>(null);

  const handleChatTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY, edge: touch.clientX < 36 };
  }, []);

  const handleChatTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start?.edge) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    // Edge swipe right = native "back" to the queue (mobile only).
    if (deltaX > 70 && deltaY < 60 && window.innerWidth < 768) mobileBackToQueue();
  }, []);

  async function runBulkAction(payload: Parameters<typeof bulkUpdateConversations>[1]) {
    if (!payload.ids.length) return;
    setBulkWorking(true);
    try {
      const result = await bulkUpdateConversations(token, payload);
      clearConversationSelection();
      await refreshConversations();
      if (activeId && payload.archive && payload.ids.includes(activeId)) {
        setActiveId(null);
        setActiveConversation(null);
      } else if (activeId) {
        await openConversation(activeId);
      }
      setInfo(`${result.updated} conversa(s) atualizada(s).`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aplicar a ação em lote");
    } finally {
      setBulkWorking(false);
    }
  }

  useEffect(() => {
    if (roleIsAgent) {
      setQueueDepartmentId(selfUser?.teamId ?? "all");
      setQueueOwnerId(user.id);
      return;
    }
    if (!canMonitorByUser) {
      setQueueDepartmentId(selfUser?.teamId ?? "all");
      setQueueOwnerId(user.id);
      return;
    }
    const novosTeam = teams.find((team) => team.name === "Novos");
    setQueueDepartmentId(novosTeam?.id ?? "all");
    setQueueOwnerId((current) => current || user.id);
  }, [canMonitorByUser, roleIsAgent, selfUser?.teamId, teams, user.id]);

  useEffect(() => {
    if (queueDepartmentId === "all") return;
    if (queueOwnerId === "all") return;
    const stillInDepartment = agentsByDepartment.some((agent) => agent.id === queueOwnerId);
    if (!stillInDepartment) setQueueOwnerId("all");
  }, [agentsByDepartment, queueDepartmentId, queueOwnerId]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    // New conversation opened: jump straight to the latest message.
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    // Keep pinned to bottom while late-loading content (media) grows the thread.
    const content = el.firstElementChild ?? el;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [activeConversation?.id]);

  useEffect(() => {
    // New messages: follow only if the user is already at the bottom.
    const el = threadScrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowJumpToLatest(true);
    }
  }, [activeConversation?.messages?.length]);

  const handleThreadScroll = useCallback(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 120;
    if (distance < 120) setShowJumpToLatest(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    if (!activeId || !shortcuts.length) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setShortcutMenuOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, shortcuts.length]);

  useEffect(() => {
    if (!activeConversation?.lead?.id) return;
    const timer = setTimeout(() => {
      void saveCadence();
    }, 700);
    return () => clearTimeout(timer);
  }, [cadenceDraft, activeConversation?.lead?.id, saveCadence]);

  const visibleConversations = useMemo(() => {
    if (roleIsAgent) {
      let rows = conversations.filter((item) => item.assignedToId === user.id);
      if (queueStatusFilter !== "all") rows = rows.filter((item) => item.status === queueStatusFilter);
      if (queueInstanceId !== "all") rows = rows.filter((item) => item.instance?.id === queueInstanceId);
      return rows;
    }
    if (!canMonitorByUser) {
      let rows = conversations.filter((item) => item.assignedToId === user.id);
      if (queueStatusFilter !== "all") rows = rows.filter((item) => item.status === queueStatusFilter);
      if (queueInstanceId !== "all") rows = rows.filter((item) => item.instance?.id === queueInstanceId);
      return rows;
    }
    const byDepartment =
      queueDepartmentId === "all" ? conversations : conversations.filter((item) => item.teamId === queueDepartmentId);
    let rows = byDepartment;
    if (queueOwnerId === "unassigned") rows = rows.filter((item) => !item.assignedToId);
    else if (queueOwnerId !== "all") rows = rows.filter((item) => item.assignedToId === queueOwnerId);
    if (queueStatusFilter !== "all") rows = rows.filter((item) => item.status === queueStatusFilter);
    if (queueInstanceId !== "all") rows = rows.filter((item) => item.instance?.id === queueInstanceId);
    return rows;
  }, [
    canMonitorByUser,
    conversations,
    queueDepartmentId,
    queueInstanceId,
    queueOwnerId,
    queueStatusFilter,
    roleIsAgent,
    user.id
  ]);

  const pendingUploadKey = useMemo(
    () => (activeId && pendingUploadFile ? mediaUploadKey(activeId, pendingUploadFile) : null),
    [activeId, pendingUploadFile]
  );
  const pendingUploadSending = pendingUploadKey !== null && sendingMediaKey === pendingUploadKey;
  const pendingAudioKey = useMemo(
    () => (activeId && pendingAudioFile ? mediaUploadKey(activeId, pendingAudioFile) : null),
    [activeId, pendingAudioFile]
  );
  const pendingAudioSending = pendingAudioKey !== null && sendingMediaKey === pendingAudioKey;
  const mediaSendLocked = Boolean(sendingMediaKey);

  function isUnreadConversation(item: Conversation) {
    const latest = item.messages?.[0];
    if (!latest || latest.direction !== "in") return false;
    const seenAt = lastSeenByConversation[item.id] ?? 0;
    const latestAt = new Date(latest.createdAt ?? item.lastMessageAt ?? 0).getTime();
    return latestAt > seenAt;
  }

  function isOverdueConversation(item: Conversation) {
    void slaTick;
    return isConversationOverSla(item, slaConfig);
  }

  const managerAlertCount = visibleConversations.filter((item) => isOverdueConversation(item)).length;

  const filtered = useMemo(() => {
    let rows = visibleConversations;
    if (tagFilter.length) {
      rows = rows.filter((conversation) => {
        const tags = conversationDisplayTags(conversation.tags);
        return tagFilter.every((selected) =>
          tags.some((tag) => tag.toLowerCase() === selected.toLowerCase())
        );
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerPhone.includes(q) ||
          c.lead?.company?.toLowerCase().includes(q)
      );
    }
    if (activeId && !rows.some((item) => item.id === activeId)) {
      const activeRow = conversations.find((item) => item.id === activeId);
      if (activeRow) rows = [activeRow, ...rows];
    }
    return rows;
  }, [visibleConversations, search, tagFilter, activeId, conversations]);

  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const queueVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => queueScrollRef.current,
    estimateSize: () => 74,
    overscan: 8,
    getItemKey: (index) => filtered[index]?.id ?? index
  });

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      // Inbox stays mounted while other views are shown; ignore keys when hidden.
      if (!mainRef.current || mainRef.current.offsetParent === null) return;
      if (e.key === "Escape") {
        if (shortcutsHelpOpen) {
          setShortcutsHelpOpen(false);
          return;
        }
        if (drawerOpen) {
          setDrawerOpen(false);
          return;
        }
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsHelpOpen((value) => !value);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "ArrowUp" || e.key === "k") {
        const rows = filteredRef.current;
        if (!rows.length) return;
        e.preventDefault();
        const forward = e.key === "ArrowDown" || e.key === "j";
        const currentIndex = rows.findIndex((item) => item.id === activeIdRef.current);
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(rows.length - 1, Math.max(0, currentIndex + (forward ? 1 : -1)));
        const next = rows[nextIndex];
        if (next && next.id !== activeIdRef.current) void openConversation(next.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, shortcutsHelpOpen, openConversation]);

  async function sendCurrentDraft() {
    if (sendingTextRef.current) return;
    if (!activeId) {
      setError("Aguarde a conversa abrir para enviar a mensagem.");
      return;
    }
    if (!draft.trim()) return;

    sendingTextRef.current = true;
    setSendingText(true);
    const textRaw = draft;
    const shortcutMatch = shortcuts.find((item) => item.tag.toLowerCase() === draft.trim().toLowerCase());
    const text = shortcutMatch ? shortcutMatch.text : textRaw;
    setDraft("");
    try {
      await sendMessage(token, activeId, { text, replyToMessageId: replyToMessage?.id });
      setReplyToMessage(null);
      await openConversation(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
      setDraft(textRaw);
    } finally {
      sendingTextRef.current = false;
      setSendingText(false);
    }
  }

  function patchActiveMessage(updated: Message) {
    setActiveConversation((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: mergeMessages(current.messages ?? [], updated)
      };
    });
  }

  const roleCanHideMessages = ["owner", "admin", "supervisor"].includes(user.role);

  async function handleHideMessage(message: Message) {
    if (!activeId || !roleCanHideMessages) return;
    const reason = await prompt({
      title: "Ocultar mensagem",
      description: "Supervisores ainda podem ver o conteúdo original.",
      label: "Motivo (opcional)",
      placeholder: "Ex.: conteúdo sensível",
      confirmLabel: "Ocultar"
    });
    if (reason === null) return;
    try {
      const updated = await hideMessage(token, activeId, message.id, reason);
      patchActiveMessage(updated);
      notify.success("Mensagem oculta", "Supervisores ainda podem ver o conteúdo original.");
      setError("");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível ocultar a mensagem");
    }
  }

  async function handleEditMessage(message: Message) {
    if (!activeId) return;
    const raw = (message.raw && typeof message.raw === "object" ? message.raw : {}) as Record<string, unknown>;
    const current = typeof raw.contentRaw === "string" ? raw.contentRaw : message.text ?? "";
    const next = await prompt({
      title: "Editar mensagem",
      description: "A edição é aplicada no Atlas One e no WhatsApp do cliente.",
      defaultValue: current,
      multiline: true,
      confirmLabel: "Salvar edição"
    });
    if (next == null || next === current) return;
    try {
      const updated = await editMessage(token, activeId, message.id, next);
      patchActiveMessage(updated);
      const nextRaw = (updated.raw && typeof updated.raw === "object" ? updated.raw : {}) as Record<string, unknown>;
      const sync = nextRaw.whatsappSync && typeof nextRaw.whatsappSync === "object" ? (nextRaw.whatsappSync as Record<string, unknown>) : null;
      if (sync?.synced === true) {
        notify.success("Mensagem editada", "Atualizada no Atlas One e no WhatsApp do cliente.");
      } else {
        notify.info("Mensagem editada no Atlas One", "WhatsApp não sincronizado (sem ID do provedor).");
      }
      setError("");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível editar a mensagem");
    }
  }

  async function handleTranscribeMessage(message: Message) {
    if (!activeId) return;
    try {
      setInfo("Transcrevendo áudio...");
      const updated = await transcribeMessage(token, activeId, message.id);
      patchActiveMessage(updated);
      setInfo("Audio transcrito.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcrição indisponível. Configure OPENAI_API_KEY no servidor.");
    }
  }

  function insertShortcut(shortcut: ShortcutItem) {
    setDraft((current) => {
      const trimmed = current.trim();
      if (!trimmed) return shortcut.text;
      if (trimmed.toLowerCase() === shortcut.tag.toLowerCase()) return shortcut.text;
      return `${current}\n${shortcut.text}`;
    });
    setError("");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sendingTextRef.current) return;
    await sendCurrentDraft();
  }

  async function handleFile(file: File) {
    if (!activeId || sendingMediaRef.current) return;
    if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
    const kind = mediaPreviewKind(file);
    const previewUrl = kind === "image" || kind === "video" || kind === "audio" ? URL.createObjectURL(file) : "";
    setPendingUploadFile(file);
    setPendingUploadUrl(previewUrl);
    setPendingUploadCaption("");
    setError("");
  }

  async function sendPendingUpload() {
    if (!activeId || !pendingUploadFile) return;
    const uploadKey = mediaUploadKey(activeId, pendingUploadFile);
    if (sendingMediaRef.current === uploadKey) return;

    sendingMediaRef.current = uploadKey;
    setSendingMediaKey(uploadKey);
    try {
      await sendMediaFile(token, activeId, pendingUploadFile, pendingUploadCaption.trim() || undefined);
      if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
      setPendingUploadFile(null);
      setPendingUploadUrl("");
      setPendingUploadCaption("");
      setError("");
      await openConversation(activeId);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar arquivo");
    } finally {
      if (sendingMediaRef.current === uploadKey) {
        sendingMediaRef.current = null;
        setSendingMediaKey(null);
      }
    }
  }

  function discardPendingUpload() {
    if (sendingMediaRef.current) return;
    if (pendingUploadUrl) URL.revokeObjectURL(pendingUploadUrl);
    setPendingUploadFile(null);
    setPendingUploadUrl("");
    setPendingUploadCaption("");
  }

  async function toggleRecord() {
    if (!activeId) return;
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPendingAudioFile(file);
        setPendingAudioUrl(url);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Permita acesso ao microfone para gravar áudio");
    }
  }

  async function sendPendingAudio() {
    if (!activeId || !pendingAudioFile) return;
    const uploadKey = mediaUploadKey(activeId, pendingAudioFile);
    if (sendingMediaRef.current === uploadKey) return;

    sendingMediaRef.current = uploadKey;
    setSendingMediaKey(uploadKey);
    try {
      await sendMediaFile(token, activeId, pendingAudioFile);
      if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
      setPendingAudioFile(null);
      setPendingAudioUrl("");
      setError("");
      await openConversation(activeId);
      await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar áudio");
    } finally {
      if (sendingMediaRef.current === uploadKey) {
        sendingMediaRef.current = null;
        setSendingMediaKey(null);
      }
    }
  }

  function discardPendingAudio() {
    if (sendingMediaRef.current) return;
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioFile(null);
    setPendingAudioUrl("");
  }

  async function updateActiveTags(displayTags: string[]) {
    if (!activeId || !activeConversation) return;
    setTagsSaving(true);
    try {
      const merged = mergeConversationTags(activeConversation.tags, displayTags);
      await updateConversation(token, activeId, { tags: merged });
      await openConversation(activeId);
      await refreshConversations();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar tags");
    } finally {
      setTagsSaving(false);
    }
  }

  async function transferTo(agent: UserRow, transferNote?: string) {
    if (!activeId) return;
    setTransferLoading(true);
    try {
      await updateConversation(token, activeId, {
        assignedToId: agent.id || null,
        teamId: agent.teamId ?? null,
        transferNote
      });
      const items = await refreshConversations();
      const monitorId = roleIsAgent ? user.id : queueOwnerId;
      const movedAway = monitorId !== "all" && agent.id !== monitorId;
      if (movedAway) {
        setActiveConversation(null);
        setActiveId(null);
      } else {
        await openConversation(activeId);
      }
      setInfo(movedAway ? "Conversa transferida e removida da sua fila." : "Atendimento transferido com sucesso.");
      setError("");
      if (movedAway && items[0]) {
        const firstAssigned =
          monitorId === "all" ? items[0] : items.find((item) => item.assignedToId === monitorId) ?? null;
        if (firstAssigned) await openConversation(firstAssigned.id);
      }
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao transferir atendimento");
    } finally {
      setTransferLoading(false);
    }
  }

  function getAvatarUrl(tags: unknown) {
    if (!Array.isArray(tags)) return null;
    const found = tags.find((tag) => typeof tag === "string" && tag.startsWith("avatar:"));
    if (typeof found !== "string") return null;
    const value = found.slice("avatar:".length).trim();
    return normalizeAvatarUrl(value);
  }

  async function handleCreateConversation() {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    const normalizedPhone = normalizeWhatsAppNumber(newContact.phone.trim());
    if (!normalizedPhone) {
      setError("Informe um WhatsApp valido para criar o contato.");
      return;
    }
    try {
      const preferredInstance = active?.instance?.name ?? conversations.find((item) => item.instance?.name)?.instance?.name;
      const created = await createConversation(token, {
        ...(preferredInstance ? { instanceName: preferredInstance } : {}),
        customerName: newContact.name.trim(),
        customerPhone: normalizedPhone
      });
      setActiveId(created.id);
      setActiveConversation({ ...created, messages: created.messages ?? [] });
      setNewContact({ name: "", phone: "" });
      setNewContactModalOpen(false);
      await refreshConversations();
      await openConversation(created.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar contato");
    }
  }

  async function handleArchiveActiveConversation() {
    if (!active) return;
    const ok = await confirm({
      title: `Arquivar conversa de ${active.customerName}?`,
      description: "Ela permanece no histórico e pode ser buscada a qualquer momento.",
      confirmLabel: "Arquivar"
    });
    if (!ok) return;
    try {
      await archiveConversation(token, active.id);
      setActiveConversation(null);
      setActiveId(null);
      const items = await refreshConversations();
      if (items[0]) await openConversation(items[0].id);
      setError("");
      notify.success(`Conversa de ${active.customerName} arquivada.`);
    } catch (err) {
      setInfo("");
      notify.error(err instanceof Error ? err.message : "Falha ao arquivar conversa");
    }
  }

  async function saveContactIdentity() {
    if (!activeId || !active) return;
    const name = contactDraft.customerName.trim();
    const phone = contactDraft.customerPhone.trim();
    if (!name || !phone) {
      setInfo("");
      setError("Preencha nome e telefone do cliente para salvar.");
      return;
    }
    try {
      await updateConversation(token, activeId, { customerName: name, customerPhone: phone });
      if (activeConversation?.lead?.id) {
        await updateLead(token, activeConversation.lead.id, {
          customFields: { cadence: cadenceDraft }
        });
      }
      await refreshConversations();
      await openConversation(activeId);
      setInfo("Nome/telefone do cliente atualizados.");
      setError("");
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Falha ao atualizar dados do cliente");
    }
  }

  const active = activeConversation;
  const activeCustomerAvatar = active ? getAvatarUrl(active.tags) : null;

  async function setStatusQuick(status: LifecycleStatus) {
    if (!active) return;
    try {
      const closingStatuses = new Set<LifecycleStatus>(["closed", "resolved", "archived"]);
      if (closingStatuses.has(status)) {
        await updateConversation(token, active.id, {
          status,
          assignedToId: status === "archived" ? null : active.assignedToId ?? null,
          teamId: status === "closed" || status === "archived" ? null : active.teamId ?? null
        });
        const items = await refreshConversations();
        if (roleIsAgent && (status === "closed" || status === "archived")) {
          setActiveConversation(null);
          setActiveId(null);
          const nextMine = items.find((item) => item.assignedToId === user.id) ?? null;
          if (nextMine) await openConversation(nextMine.id);
          setInfo(`Atendimento ${statusLabel(status).toLowerCase()} e removido da sua fila.`);
        } else {
          await openConversation(active.id);
          setInfo(`Status atualizado: ${statusLabel(status)}.`);
        }
        return;
      }

      await updateConversation(token, active.id, { status });
      await openConversation(active.id);
      setInfo(`Status atualizado: ${statusLabel(status)}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o status");
    }
  }

  async function uploadInternalPhoto(file: File) {
    try {
      const dataUrl = await compressImageFile(file);
      const uploaded = await uploadUserAvatar(token, dataUrl, "image/jpeg");
      setInternalPhoto(resolveDisplayAvatar(uploaded.avatarUrl, token) ?? null);
      localStorage.setItem(profilePhotoStorageKey(user.tenantId, user.id), dataUrl);
      const users = await listUsers(token);
      setAgents(users);
      setInfo("Foto do atendente salva e visivel para a equipe.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a foto");
    }
  }

  function logout() {
    void apiLogout(token).catch(() => {});
    localStorage.removeItem("atlas:token");
    localStorage.removeItem("atlas-one-session");
    localStorage.removeItem("atlas-one-session-v2");
    window.location.reload();
  }

  return (
    <main ref={mainRef} className="mx-auto h-full w-full max-w-[1920px] overflow-hidden p-1.5 sm:p-2.5">
      <section className="inbox-v42-shell atlas-v5-module-shell flex h-full min-h-0 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
          <div
            className={`inbox-v42-queue relative min-w-0 flex-col ${INBOX_PANEL_CLASS} ${
              mobileShowsChat ? "hidden md:flex" : "flex"
            } min-h-0 flex-1 md:min-h-0`}
          >
            <div className="shrink-0 space-y-2.5 border-b border-slate-200/40 px-3 pb-3 pt-3">
              <div className="flex items-center justify-between gap-1">
                <p className="inbox-v43-queue-title">Inbox</p>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                      bulkSelectMode ? "bg-slate-900 text-white" : "border border-slate-200/80 bg-white/70 text-slate-600 hover:bg-white"
                    }`}
                    title={bulkSelectMode ? "Sair da seleção" : "Selecionar várias conversas"}
                    onClick={() => {
                      if (bulkSelectMode) clearConversationSelection();
                      else setBulkSelectMode(true);
                    }}
                  >
                    <ListChecks size={13} />
                    {bulkSelectMode ? "Cancelar" : "Selecionar"}
                  </button>
                  <button
                    type="button"
                    className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-white/70 md:inline-flex"
                    title="Atalhos de teclado ( ? )"
                    onClick={() => setShortcutsHelpOpen(true)}
                  >
                    <Keyboard size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70"
                    title="Perfil e notificações"
                    onClick={() => setProfileOpen(true)}
                  >
                    <User size={15} />
                  </button>
                </div>
              </div>
              <div className="inbox-v42-segment" role="tablist" aria-label="Filas">
                {(Object.keys(INBOX_QUEUE_BUCKETS) as Array<keyof typeof INBOX_QUEUE_BUCKETS>).map((bucket) => (
                  <button
                    key={bucket}
                    type="button"
                    role="tab"
                    data-active={queueBucket === bucket}
                    aria-selected={queueBucket === bucket}
                    onClick={() => {
                      setQueueBucket(bucket);
                      if (bucket === "active") setQueueStatusFilter("all");
                    }}
                    title={INBOX_QUEUE_BUCKET_HELP[bucket]}
                  >
                    {INBOX_QUEUE_BUCKETS[bucket]}
                  </button>
                ))}
              </div>
              <input
                ref={searchInputRef}
                className="inbox-v42-search"
                placeholder="Buscar...  ( / )"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.currentTarget.blur();
                    if (search) setSearch("");
                  }
                }}
              />
            {activeQueueFilters.length ? (
              <div className="flex flex-wrap gap-1 px-0.5">
                {activeQueueFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-2 py-0.5 text-[10px] text-slate-700"
                    onClick={filter.onClear}
                  >
                    {filter.label}
                    <X size={10} />
                  </button>
                ))}
                <button
                  type="button"
                  className="text-[10px] text-slate-500 underline-offset-2 hover:underline"
                  onClick={() => {
                    setQueueDepartmentId("all");
                    setQueueOwnerId("all");
                    setQueueStatusFilter("all");
                    setQueueInstanceId("all");
                  }}
                >
                  Limpar
                </button>
              </div>
            ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-200/50 px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-slate-600">
                {filtered.length} conversa{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-0.5">
                {bulkSelectMode && filtered.length ? (
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-white/60"
                    onClick={() =>
                      setSelectedConversationIds((current) =>
                        current.length === filtered.length ? [] : filtered.map((item) => item.id)
                      )
                    }
                  >
                    {selectedConversationIds.length === filtered.length ? "Nenhuma" : "Todas"}
                  </button>
                ) : null}
                {canMonitorByUser ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="glass" size="icon" className="h-7 w-7" title="Filtrar fila">
                        <Filter size={14} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[min(100vw-2rem,320px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                      <p className="mb-2 text-[11px] font-semibold text-slate-600">Departamento</p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            queueDepartmentId === "all" ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white"
                          }`}
                          onClick={() => {
                            setQueueDepartmentId("all");
                            setQueueOwnerId("all");
                          }}
                        >
                          Todos
                        </button>
                        {departmentOptions.map((department) => (
                          <button
                            key={department.id}
                            type="button"
                            className={`rounded-full border px-2 py-0.5 text-[10px] ${
                              queueDepartmentId === department.id ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white"
                            }`}
                            onClick={() => {
                              setQueueDepartmentId(department.id);
                              setQueueOwnerId("all");
                            }}
                          >
                            {department.name}
                          </button>
                        ))}
                      </div>
                      {queueDepartmentId !== "all" ? (
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-semibold text-slate-500">Atendente</p>
                          <AppCombobox
                            value={queueOwnerId}
                            onChange={setQueueOwnerId}
                            searchable
                            options={[
                              { value: "all", label: "Todos deste departamento" },
                              { value: "unassigned", label: "Sem atendente" },
                              ...agentsByDepartment.map((agent) => ({
                                value: agent.id,
                                label: agent.name,
                                description: agent.team?.name ?? agentDepartment(agent)
                              }))
                            ]}
                          />
                        </div>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                ) : null}
                <TagFilterPopover catalog={tagCatalog} selected={tagFilter} onChange={setTagFilter} />
                <Button
                  type="button"
                  variant="glass"
                  size="icon"
                  className="h-7 w-7"
                  title="Novo contato"
                  onClick={() => setNewContactModalOpen(true)}
                >
                  <Plus size={15} />
                </Button>
              </div>
            </div>
            {loading && !filtered.length ? (
              <QueueSkeleton />
            ) : !filtered.length ? (
              <div className="mt-6 px-2 text-center text-xs text-slate-500">
                {queueBucket === "history"
                  ? "Nenhuma conversa no histórico com estes filtros. Tente Todas ou limpe a busca."
                  : "Nenhuma conversa encontrada com os filtros atuais."}
              </div>
            ) : null}
              <div ref={queueScrollRef} className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
                <div className="relative w-full" style={{ height: `${queueVirtualizer.getTotalSize()}px` }}>
                  {queueVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filtered[virtualRow.index];
                    if (!item) return null;
                    const slaState = computeConversationSla(item, slaConfig);
                    return (
                      <div
                        key={item.id}
                        ref={queueVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="absolute left-0 top-0 w-full pb-0.5"
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <ConversationRow
                          item={item}
                          token={token}
                          avatarUrl={getAvatarUrl(item.tags)}
                          selected={item.id === activeId}
                          checked={selectedConversationIds.includes(item.id)}
                          bulkSelectMode={bulkSelectMode}
                          unread={isUnreadConversation(item)}
                          overdue={isOverdueConversation(item)}
                          slaSummary={slaState.summaryLabel}
                          slaDetail={slaState.detailLabel}
                          slaTone={slaState.tone}
                          tagCatalog={tagCatalog}
                          onOpen={openConversation}
                          onToggleSelect={toggleConversationSelection}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <InboxBulkBar
                count={selectedConversationIds.length}
                working={bulkWorking}
                agents={agents}
                teams={teams}
                tagCatalog={tagCatalog}
                onClear={clearConversationSelection}
                onTransfer={(agentId, note) =>
                  runBulkAction({ ids: selectedConversationIds, assignedToId: agentId, transferNote: note })
                }
                onAddTags={(tags) => runBulkAction({ ids: selectedConversationIds, addTags: tags })}
                onStatus={(status) => runBulkAction({ ids: selectedConversationIds, status })}
                onArchive={() => runBulkAction({ ids: selectedConversationIds, archive: true })}
                onDepartment={(teamId) => runBulkAction({ ids: selectedConversationIds, teamId })}
              />
          </div>

          <div
            className={`min-w-0 flex-col ${INBOX_PANEL_CLASS} ${
              mobileShowsChat ? "flex min-h-0 flex-1" : "hidden min-h-0 flex-1 md:flex"
            }`}
            onTouchStart={handleChatTouchStart}
            onTouchEnd={handleChatTouchEnd}
          >
              {roleIsManager && managerAlertCount > 0 ? (
                <div className="shrink-0 border-b border-rose-200/60 bg-rose-50/80 px-4 py-1.5 text-center text-[11px] font-medium text-rose-800">
                  {managerAlertCount} conversa{managerAlertCount === 1 ? "" : "s"} fora do SLA
                </div>
              ) : null}
              {active ? (
                <>
                  <ConversationHeaderBar
                    active={active}
                    customerAvatarUrl={activeCustomerAvatar}
                    accessToken={token}
                    onSetStatus={(status) => void setStatusQuick(status)}
                    onOpenDrawer={() => setDrawerOpen(true)}
                    onMobileBack={mobileBackToQueue}
                  />
                  <div
                    ref={threadScrollRef}
                    onScroll={handleThreadScroll}
                    className="inbox-v42-thread atlas-scroll relative isolate flex-1 overflow-auto py-5 sm:py-6"
                  >
                    <div className="inbox-v43-thread-column px-4 sm:px-5">
                      {groupMessagesForThread(active.messages ?? []).map((group) => (
                        <section key={group.dateKey} className="mb-5 last:mb-0">
                          <div className="sticky top-0 z-20 mb-3 flex justify-center">
                            <span className="rounded-full border border-slate-200/50 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur-md">
                              {group.dateLabel}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {group.clusters.map((cluster, clusterIndex) => (
                              <div key={`${group.dateKey}-${clusterIndex}`} className="space-y-0">
                                {cluster.map((m, messageIndex) => (
                                  <MessageBubble
                                    key={m.id}
                                    message={m}
                                    token={token}
                                    canManage={roleCanHideMessages}
                                    clustered={cluster.length > 1}
                                    clusterFirst={messageIndex === 0}
                                    clusterLast={messageIndex === cluster.length - 1}
                                    onReply={(message) => setReplyToMessage(message)}
                                    canHide={roleCanHideMessages}
                                    onHide={(message) => void handleHideMessage(message)}
                                    onEdit={(message) => void handleEditMessage(message)}
                                    onTranscribe={(message) => void handleTranscribeMessage(message)}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                  {showJumpToLatest ? (
                    <div className="pointer-events-none relative z-20">
                      <button
                        type="button"
                        onClick={jumpToLatest}
                        className="pointer-events-auto absolute -top-12 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                      >
                        <ArrowDown size={13} />
                        Novas mensagens
                      </button>
                    </div>
                  ) : null}
                  {pendingAudioFile ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-700">
                        {pendingAudioSending ? "Enviando áudio..." : "Áudio gravado (pré-escuta antes de enviar)"}
                      </p>
                      <audio controls src={pendingAudioUrl} className="w-full" />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={pendingAudioSending} onClick={() => void sendPendingAudio()}>
                          {pendingAudioSending ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            "Enviar áudio"
                          )}
                        </Button>
                        <Button size="sm" variant="glass" disabled={pendingAudioSending} onClick={discardPendingAudio}>
                          Descartar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {pendingUploadFile ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="mb-2 text-xs font-semibold text-blue-700">
                        {pendingUploadSending ? "Enviando arquivo..." : "Arquivo selecionado (confirme antes de enviar)"}
                      </p>
                      {mediaPreviewKind(pendingUploadFile) === "image" && pendingUploadUrl ? (
                        <img src={pendingUploadUrl} alt="Preview da imagem" className="max-h-56 rounded-xl object-contain" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "video" && pendingUploadUrl ? (
                        <video controls src={pendingUploadUrl} className="max-h-56 rounded-xl" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "audio" && pendingUploadUrl ? (
                        <audio controls src={pendingUploadUrl} className="w-full" />
                      ) : null}
                      {mediaPreviewKind(pendingUploadFile) === "document" ? (
                        <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs">
                          {pendingUploadFile.name}
                        </div>
                      ) : null}
                      <input
                        className="mt-2 w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs outline-none disabled:opacity-60"
                        placeholder="Legenda opcional (deixe vazio para enviar sem texto)"
                        value={pendingUploadCaption}
                        disabled={pendingUploadSending}
                        onChange={(e) => setPendingUploadCaption(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!pendingUploadSending) void sendPendingUpload();
                          }
                        }}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" disabled={pendingUploadSending} onClick={() => void sendPendingUpload()}>
                          {pendingUploadSending ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            "Enviar arquivo"
                          )}
                        </Button>
                        <Button size="sm" variant="glass" disabled={pendingUploadSending} onClick={discardPendingUpload}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {replyToMessage ? (
                    <div className="mx-4 mb-2 rounded-2xl border border-slate-200 bg-white/75 px-3 py-2 text-xs backdrop-blur">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <CornerUpLeft size={12} />
                            Respondendo mensagem especifica
                          </p>
                          <p className="truncate text-slate-500">{replyToMessage.text ?? `[${replyToMessage.type}]`}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                          onClick={() => setReplyToMessage(null)}
                          aria-label="Cancelar resposta direcionada"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {buildSignaturePreview(draft, user, companySettings?.messaging) ? (
                    <div className="mx-4 mb-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
                      <p className="mb-1 font-semibold">Preview enviado ao cliente (com assinatura):</p>
                      <p className="whitespace-pre-wrap">{buildSignaturePreview(draft, user, companySettings?.messaging)}</p>
                    </div>
                  ) : null}
                  <form onSubmit={handleSend} className="inbox-v42-composer z-10 sm:px-2">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <div className="inbox-v43-composer-inner">
                      <div className="inbox-v43-composer-tools">
                        <button
                          type="button"
                          className="inbox-v43-composer-tool"
                          disabled={mediaSendLocked || sendingText}
                          onClick={() => fileRef.current?.click()}
                          title="Anexar arquivo"
                        >
                          <Paperclip size={17} />
                        </button>
                        <QuickRepliesMenu
                          shortcuts={shortcuts}
                          disabled={!activeId}
                          open={shortcutMenuOpen}
                          onOpenChange={setShortcutMenuOpen}
                          onSelect={insertShortcut}
                          triggerClassName="inbox-v43-composer-tool"
                        />
                        <button
                          type="button"
                          className={`inbox-v43-composer-tool ${recording ? "text-rose-500" : ""}`}
                          disabled={mediaSendLocked || sendingText}
                          onClick={toggleRecord}
                          title={recording ? "Parar gravação" : "Gravar áudio"}
                        >
                          {recording ? <Square size={15} /> : <Mic size={17} />}
                        </button>
                      </div>
                      <textarea
                        ref={composerRef}
                        rows={1}
                        className="inbox-v43-composer-input"
                        placeholder="Escreva uma mensagem..."
                        value={draft}
                        disabled={sendingText}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!sendingText && draft.trim()) void sendCurrentDraft();
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="inbox-v43-composer-send"
                        disabled={!draft.trim() || sendingText || mediaSendLocked}
                        title="Enviar"
                      >
                        {sendingText ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="inbox-v42-thread grid flex-1 place-items-center gap-2 px-6 text-center text-slate-500">
                  <MessageCircle size={36} className="text-slate-300" strokeWidth={1.25} />
                  <p className="text-sm font-medium text-slate-600">Selecione uma conversa</p>
                  <p className="max-w-xs text-xs text-slate-400">Escolha um contato na fila para responder ou use + para iniciar um novo.</p>
                </div>
              )}
            </div>
        </div>
          {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
          {!error && info ? <p className="shrink-0 text-sm text-emerald-700">{info}</p> : null}
      </section>
      <ConversationDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        active={active}
        token={token}
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        cadenceDraft={cadenceDraft}
        setCadenceDraft={setCadenceDraft}
        onSaveContact={() => void saveContactIdentity()}
        onSaveCadence={() => void saveCadence()}
        onDelete={() => void handleArchiveActiveConversation()}
        onTransfer={(agent, note) => void transferTo(agent, note)}
        transferring={transferLoading}
        agents={agents}
        tagCatalog={tagCatalog}
        tagsSaving={tagsSaving}
        onTagsChange={(tags) => updateActiveTags(tags)}
        sessionUser={user}
        composerDraft={draft}
        onApplySuggestedReply={(text) => setDraft(text)}
        onApplyPolish={(text) => setDraft(text)}
      />
      <NewContactModal
        open={newContactModalOpen}
        onClose={() => setNewContactModalOpen(false)}
        name={newContact.name}
        phone={newContact.phone}
        onNameChange={(value) => setNewContact((s) => ({ ...s, name: value }))}
        onPhoneChange={(value) => setNewContact((s) => ({ ...s, phone: value }))}
        onSubmit={() => void handleCreateConversation()}
        disabled={!newContact.name.trim() || !newContact.phone.trim()}
      />
      <UserProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        userPhone={selfUser?.phone ?? null}
        activeDepartment={selfUser?.team?.name ?? roleLabel(selfUser?.role ?? user.role)}
        activeInstanceLabel={active?.instance ? `${active.instance.label} (${active.instance.name})` : undefined}
        internalPhoto={internalPhoto}
        onUploadPhoto={uploadInternalPhoto}
        onLogout={logout}
        notificationPrefs={notificationPrefs}
        onNotificationPrefsChange={updateNotificationPrefs}
        canMonitorQueue={canMonitorByUser}
        notifyPermission={notifyPermission}
        onRequestNotificationPermission={() => void handleRequestNotificationPermission()}
      />
      <ShortcutsHelpOverlay open={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />
    </main>
  );
}
