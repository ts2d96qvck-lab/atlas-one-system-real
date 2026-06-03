"use client";

import { useState } from "react";
import { aiAskAtlas, ASK_ATLAS_PROMPTS, copyAtlasAiText } from "../../lib/atlas-ai";
import {
  AtlasAiActionBar,
  AtlasAiConfigureEmpty,
  AtlasAiField,
  AtlasAiList,
  AtlasAiResultCard,
  AtlasAiShell,
  useAiRunner,
  useAtlasAiReady
} from "./atlas-ai-shared";
import { Button } from "@atlas-one/ui";

type Props = { token: string };

export function AtlasAiAskPanel({ token }: Props) {
  const configured = useAtlasAiReady(token);
  const { loadingKey, error, results, run } = useAiRunner(token);
  const [question, setQuestion] = useState("");

  if (configured === false) {
    return (
      <div className="atlas-v5-card-pad">
        <AtlasAiConfigureEmpty />
      </div>
    );
  }

  const answer = results.ask?.data;

  return (
    <div className="atlas-v5-card-pad">
      <AtlasAiShell subtitle="Perguntar ao Atlas — análise inicial">
        <div className="px-3 pb-2">
          <p className="text-[11px] text-slate-500">
            Respostas baseadas nos dados do painel. Sem números inventados.
          </p>
          <div className="atlas-ai-pill-row mt-2">
            {ASK_ATLAS_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="atlas-ai-pill text-left"
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <textarea
            className="atlas-field mt-3 min-h-[80px] w-full rounded-xl px-3 py-2 text-sm outline-none"
            placeholder="Ex.: O que devo priorizar hoje na operação?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            className="mt-2 h-9 w-full text-xs"
            disabled={!!loadingKey || !question.trim() || configured === null}
            onClick={() => void run("ask", () => aiAskAtlas(token, question))}
          >
            {loadingKey === "ask" ? "Analisando operação…" : "Perguntar ao Atlas"}
          </Button>
        </div>

        {answer ? (
          <div className="mx-3 mb-3">
            <AtlasAiResultCard>
              {answer.analiseInicial ? (
                <p className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Análise inicial
                </p>
              ) : null}
              <AtlasAiField label={String(answer.titulo ?? "Resposta")} value={String(answer.resposta ?? "")} />
              <AtlasAiList label="Destaques" items={answer.destaques as string[]} />
              <AtlasAiList label="Ações sugeridas" items={answer.acoesSugeridas as string[]} />
              <AtlasAiField label="Dados em falta" value={String(answer.dadosFaltantes ?? "")} />
              <AtlasAiActionBar onCopy={() => void copyAtlasAiText(String(answer.resposta ?? ""))} />
            </AtlasAiResultCard>
          </div>
        ) : null}

        {error && !loadingKey ? <p className="mx-3 mb-3 text-xs text-rose-600">{error}</p> : null}
      </AtlasAiShell>
    </div>
  );
}
