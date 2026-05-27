import type { TranscriptionProvider, TranscriptionResult } from "./transcription.provider";

export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai";

  async transcribe(input: { buffer: Buffer; mimeType: string; language?: string }): Promise<TranscriptionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Configure OPENAI_API_KEY no ambiente para transcrever audios.");
    }

    const model = process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-1";
    const ext = input.mimeType.includes("mpeg") ? "mp3" : input.mimeType.includes("mp4") ? "m4a" : "ogg";
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType || "audio/ogg" }), `audio.${ext}`);
    form.append("model", model);
    form.append("language", input.language ?? "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha na transcricao OpenAI (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const payload = (await response.json()) as { text?: string };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) throw new Error("Transcricao vazia retornada pelo provedor.");
    return { text, language: input.language ?? "pt", provider: this.name };
  }
}
