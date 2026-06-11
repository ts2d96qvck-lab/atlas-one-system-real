"use client";

import { useState } from "react";
import { LogOut, Volume2, VolumeX, X } from "lucide-react";
import { Button, Switch } from "@atlas-one/ui";
import type { SessionUser } from "../../lib/api";
import type { InboxNotificationPrefs } from "../../lib/inbox-notifications";
import { CustomerAvatar, roleLabel } from "./inbox-utils";

export type NewContactModalProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled: boolean;
};

export function NewContactModal({
  open,
  onClose,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onSubmit,
  disabled
}: NewContactModalProps) {
  if (!open) return null;

  return (
    <div className="atlas-v5-modal-backdrop">
      <div className="atlas-v5-modal-panel max-w-md animate-atlas-pop-in">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">Novo contato</p>
            <p className="text-xs text-slate-500">Inicie uma conversa com um cliente</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            className="atlas-field w-full rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="Nome do cliente"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <input
            className="atlas-field w-full rounded-lg px-3 py-2 text-sm outline-none"
            placeholder="WhatsApp com DDD"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled) void onSubmit();
            }}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="glass" className="h-9 px-3 text-xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="h-9 px-3 text-xs" disabled={disabled} onClick={() => void onSubmit()}>
            Criar conversa
          </Button>
        </div>
      </div>
    </div>
  );
}

export type UserProfileModalProps = {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  userPhone?: string | null;
  activeInstanceLabel?: string;
  activeDepartment?: string;
  internalPhoto?: string | null;
  onUploadPhoto: (file: File) => Promise<void>;
  onLogout: () => void;
  notificationPrefs: InboxNotificationPrefs;
  onNotificationPrefsChange: (patch: Partial<InboxNotificationPrefs>) => void;
  canMonitorQueue: boolean;
  notifyPermission: NotificationPermission | "unsupported";
  onRequestNotificationPermission: () => void | Promise<void>;
};

export function UserProfileModal({
  open,
  onClose,
  user,
  userPhone,
  activeInstanceLabel,
  activeDepartment,
  internalPhoto,
  onUploadPhoto,
  onLogout,
  notificationPrefs,
  onNotificationPrefsChange,
  canMonitorQueue,
  notifyPermission,
  onRequestNotificationPermission
}: UserProfileModalProps) {
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  return (
    <div className="atlas-v5-modal-backdrop">
      <div className="atlas-v5-modal-panel max-w-md animate-atlas-pop-in">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-semibold">Perfil do atendente</p>
            <p className="text-xs text-slate-500">Dados internos da equipe</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {internalPhoto ? (
            <img src={internalPhoto} alt="Foto interna" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <CustomerAvatar name={user.name} phone={user.email} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Cargo</p>
            <p className="font-semibold text-slate-800">{roleLabel(user.role)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Telefone de cadastro</p>
            <p className="font-semibold text-slate-800">{userPhone ? `+${userPhone}` : "Não informado"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Departamento atual</p>
            <p className="font-semibold text-slate-800">{activeDepartment || roleLabel(user.role)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-slate-500">Número/instância em uso</p>
            <p className="font-semibold text-slate-800">{activeInstanceLabel || "Sem instância ativa"}</p>
          </div>
        </div>

        <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
          {uploading ? "Enviando foto interna..." : "Enviar foto interna (somente validação da equipe)"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setUploading(true);
              try {
                await onUploadPhoto(file);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-semibold text-slate-800">Notificações do Inbox</p>
          <p className="mt-1 text-[11px] text-slate-500">Alertas locais para novas mensagens recebidas.</p>
          {notifyPermission === "unsupported" ? (
            <p className="mt-2 text-[11px] text-amber-700">Este navegador não suporta notificações.</p>
          ) : notifyPermission === "denied" ? (
            <p className="mt-2 text-[11px] text-amber-700">
              Notificações bloqueadas no navegador. Libere nas configurações do site.
            </p>
          ) : notifyPermission === "default" ? (
            <Button
              variant="glass"
              className="mt-2 h-8 px-3 text-xs"
              onClick={() => void onRequestNotificationPermission()}
            >
              Ativar notificações
            </Button>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-700">Notificações ativas neste navegador.</p>
          )}
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2 text-slate-700">
              {notificationPrefs.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              Som ao receber mensagem
            </span>
            <Switch
              checked={notificationPrefs.soundEnabled}
              onCheckedChange={(checked) => onNotificationPrefsChange({ soundEnabled: checked })}
            />
          </label>
          {canMonitorQueue ? (
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
              <span className="text-slate-700">Alertar fila sem atendente</span>
              <Switch
                checked={notificationPrefs.supervisorQueueAlerts}
                onCheckedChange={(checked) => onNotificationPrefsChange({ supervisorQueueAlerts: checked })}
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="glass" className="h-8 px-3 text-xs" onClick={onClose}>
            Fechar
          </Button>
          <Button className="h-8 px-3 text-xs" onClick={onLogout}>
            <LogOut size={13} />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
