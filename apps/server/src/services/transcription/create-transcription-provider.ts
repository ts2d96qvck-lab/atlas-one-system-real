import { NoopTranscriptionProvider, type TranscriptionProvider } from "./transcription.provider";
import { OpenAiTranscriptionProvider } from "./openai.provider";
import { GroqTranscriptionProvider } from "./groq.provider";

export function createTranscriptionProvider(): TranscriptionProvider {
  const configured = (process.env.TRANSCRIPTION_PROVIDER ?? "").trim().toLowerCase();

  if (configured === "groq" || process.env.GROQ_API_KEY?.trim()) {
    return new GroqTranscriptionProvider();
  }
  if (configured === "openai" || process.env.OPENAI_API_KEY?.trim()) {
    return new OpenAiTranscriptionProvider();
  }
  return new NoopTranscriptionProvider();
}
