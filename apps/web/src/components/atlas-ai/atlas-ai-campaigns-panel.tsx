"use client";

import { useState } from "react";
import {
  aiCampaignCompliance,
  aiCampaignImproveMessage,
  aiCampaignVariations,
  CAMPAIGN_MODE_LABELS,
  type CampaignVariationMode,
  copyAtlasAiText
} from "../../lib/atlas-ai";
import type { SessionUser } from "../../lib/api";
import {
  AtlasAiAccessFallback,
  AtlasAiActionBar,
  AtlasAiField,
  AtlasAiList,
  AtlasAiPills,
  AtlasAiResultCard,
  AtlasAiSection,
  AtlasAiShell,
  useAiRunner,
  useAtlasAiAccess
} from "./atlas-ai-shared";

const MODES = ["formal", "comercial", "executivo", "cobranca", "curta", "whatsapp_natural"] as const;

type Props = {
  token: string;
  user?: SessionUser;
  message: string;
  campaignName?: string;
  messageKind?: string;
  templateName?: string;
  onApplyMessage?: (text: string) => void;
};

export function AtlasAiCampaignsPanel({
  token,
  user,
  message,
  campaignName,
  messageKind,
  templateName,
  onApplyMessage
}: Props) {
  const access = useAtlasAiAccess(token, user);
  const { loadingKey, error, results, run } = useAiRunner(token);
  const [variationMode, setVariationMode] = useState<CampaignVariationMode>("whatsapp_natural");

  if (access !== "ready") return <AtlasAiAccessFallback access={access} />;

  const improve = results.improve?.data;
  const variation = results.variation?.data;
  const compliance = results.compliance?.data;

  const improvedText = String(improve?.mensagemMelhorada ?? improve?.improvedMessage ?? "");
  const variationText = String(variation?.variacao ?? "");

  return (
    <AtlasAiShell subtitle="Campanhas mais claras e persuasivas">
      <AtlasAiSection
        title="Melhorar mensagem"
        loading={loadingKey === "improve"}
        loadingLabel="Aprimorando mensagem…"
        runLabel="Melhorar"
        disabled={!!loadingKey || !message.trim()}
        onRun={() =>
          void run("improve", () =>
            aiCampaignImproveMessage(token, { message, campaignName, messageKind, templateName })
          )
        }
      >
        {improve ? (
          <AtlasAiResultCard>
            <AtlasAiField label="Mensagem melhorada" value={improvedText} />
            <AtlasAiField label="Por que melhorou" value={String(improve.porQueMelhorou ?? "")} />
            <AtlasAiField label="CTA sugerido" value={String(improve.ctaSugerido ?? "")} />
            <AtlasAiActionBar
              primaryLabel="Aplicar mensagem"
              onPrimary={onApplyMessage && improvedText ? () => onApplyMessage(improvedText) : undefined}
              onCopy={() => void copyAtlasAiText(improvedText)}
              onRegenerate={() =>
                void run("improve", () =>
                  aiCampaignImproveMessage(token, { message, campaignName, messageKind, templateName })
                )
              }
            />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      <AtlasAiSection
        title="Variações de mensagem"
        loading={loadingKey === "variation"}
        loadingLabel="Gerando variação…"
        runLabel="Gerar variação"
        disabled={!!loadingKey || !message.trim()}
        onRun={() =>
          void run("variation", () => aiCampaignVariations(token, { message, mode: variationMode }))
        }
      >
        <AtlasAiPills options={MODES} labels={CAMPAIGN_MODE_LABELS} value={variationMode} onChange={setVariationMode} />
        {variation ? (
          <AtlasAiResultCard>
            <AtlasAiField label="Variação" value={variationText} />
            <AtlasAiField label="Observação" value={String(variation.observacao ?? "")} />
            <AtlasAiActionBar
              primaryLabel="Aplicar"
              onPrimary={onApplyMessage && variationText ? () => onApplyMessage(variationText) : undefined}
              onCopy={() => void copyAtlasAiText(variationText)}
            />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      <AtlasAiSection
        title="Revisão de segurança"
        description="Orientações — não bloqueia o envio"
        loading={loadingKey === "compliance"}
        loadingLabel="Revisando mensagem…"
        runLabel="Revisar"
        disabled={!!loadingKey || !message.trim()}
        onRun={() => void run("compliance", () => aiCampaignCompliance(token, { message }))}
      >
        {compliance ? (
          <AtlasAiResultCard>
            <p className="text-xs font-semibold">
              Nível de risco:{" "}
              <span
                className={
                  String(compliance.nivelRisco) === "alto"
                    ? "text-rose-600"
                    : String(compliance.nivelRisco) === "medio"
                      ? "text-amber-600"
                      : "text-emerald-600"
                }
              >
                {String(compliance.nivelRisco ?? "baixo")}
              </span>
            </p>
            <AtlasAiList label="Alertas" items={compliance.alertas as string[]} />
            <AtlasAiList label="Sugestões" items={compliance.sugestoes as string[]} />
          </AtlasAiResultCard>
        ) : null}
      </AtlasAiSection>

      {error && !loadingKey ? <p className="mx-3 mb-2 text-xs text-rose-600">{error}</p> : null}
    </AtlasAiShell>
  );
}
