type MockProps = { title: string; variant: "inbox" | "crm" | "admin" | "dashboard" };

function InboxMock() {
  return (
    <div className="space-y-2 p-3">
      {["Cliente Ana — Novo lead", "João Comercial — Aguardando", "Maria Suporte — Aberto"].map((row, i) => (
        <div
          key={row}
          className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? "bg-blue-600 text-white" : "bg-white/90 text-slate-700"}`}
        >
          {row}
        </div>
      ))}
      <div className="mt-3 rounded-lg bg-white/90 p-3 text-[10px] text-slate-600">
        <p className="font-semibold text-slate-800">Conversa selecionada</p>
        <p className="mt-1">Olá! Vi seu anúncio e quero saber mais.</p>
        <p className="mt-2 text-right text-blue-600">Resposta do atendente →</p>
      </div>
    </div>
  );
}

function CrmMock() {
  const cols = [
    ["Novos", "Ana Corp"],
    ["Negociacao", "Tech Ltda"],
    ["Fechado", "Beta SA"]
  ];
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {cols.map(([col, card]) => (
        <div key={col} className="rounded-lg bg-white/80 p-2">
          <p className="text-[10px] font-bold text-slate-500">{col}</p>
          <div className="mt-2 rounded-md bg-blue-50 p-2 text-[10px] text-slate-700">{card}</div>
        </div>
      ))}
    </div>
  );
}

function AdminMock() {
  return (
    <div className="space-y-2 p-3 text-[10px]">
      <div className="flex gap-1">
        {["WhatsApp", "Usuarios", "Deptos", "API"].map((t, i) => (
          <span key={t} className={`rounded-full px-2 py-0.5 ${i === 3 ? "bg-blue-600 text-white" : "bg-white/90 text-slate-600"}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
        <p className="font-semibold">Chave API (copie agora)</p>
        <p className="mt-1 font-mono text-[9px]">atlas_live_••••••••••••</p>
      </div>
      <div className="rounded-lg bg-white/90 p-2 text-slate-600">Departamentos: Comercial · Suporte · Novos</div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {[
        ["Conversas", "127"],
        ["1a resposta", "4m"],
        ["Conversao", "18%"],
        ["Receita proj.", "R$ 48k"]
      ].map(([label, val]) => (
        <div key={label} className="rounded-lg bg-white/90 p-2">
          <p className="text-[9px] text-slate-500">{label}</p>
          <p className="text-sm font-bold text-slate-800">{val}</p>
        </div>
      ))}
    </div>
  );
}

export function ProductShowcase({ title, variant }: MockProps) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-blue-50 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[11px] font-medium text-slate-500">Atlas One — {title}</span>
      </div>
      <div className="min-h-[140px] bg-gradient-to-br from-blue-500/20 to-violet-500/10">
        {variant === "inbox" && <InboxMock />}
        {variant === "crm" && <CrmMock />}
        {variant === "admin" && <AdminMock />}
        {variant === "dashboard" && <DashboardMock />}
      </div>
      <figcaption className="px-3 py-2 text-center text-xs text-slate-500">{title}</figcaption>
    </figure>
  );
}
