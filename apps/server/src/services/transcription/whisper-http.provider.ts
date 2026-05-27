import type { TranscriptionProvider, TranscriptionResult } from "./transcription.provider";

type WhisperHttpConfig = {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export class WhisperHttpTranscriptionProvider implements TranscriptionProvider {
  readonly name: string;

  constructor(private readonly config: WhisperHttpConfig) {
    this.name = config.name;
  }

  async transcribe(input: { buffer: Buffer; mimeType: string; language?: string }): Promise<TranscriptionResult> {
    const apiKey = this.config.apiKey.trim();
    if (!apiKey) {
      throw new Error(`Configure a chave de API do provedor ${this.config.name} para transcrever audios.`);
    }

    const ext = input.mimeType.includes("mpeg") ? "mp3" : input.mimeType.includes("mp4") ? "m4a" : "ogg";
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType || "audio/ogg" }), `audio.${ext}`);
    form.append("model", this.config.model);
    form.append("language", input.language ?? "pt");

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Falha na transcricao ${this.config.name} (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
      );
    }

    const payload = (await response.json()) as { text?: string };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) throw new Error("Transcricao vazia retornada pelo provedor.");
    return { text, language: input.language ?? "pt", provider: this.name };
  }
}
