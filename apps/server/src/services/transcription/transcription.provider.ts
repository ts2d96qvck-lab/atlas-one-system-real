export type TranscriptionResult = {
  text: string;
  language?: string;
  provider: string;
};

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: { buffer: Buffer; mimeType: string; language?: string }): Promise<TranscriptionResult>;
}

export class NoopTranscriptionProvider implements TranscriptionProvider {
  readonly name = "noop";

  async transcribe(): Promise<TranscriptionResult> {
    throw new Error(
      "Transcricao indisponivel. Adicione OPENAI_API_KEY ou GROQ_API_KEY no .env (ou TRANSCRIPTION_PROVIDER=openai|groq) e reinicie a API."
    );
  }
}
