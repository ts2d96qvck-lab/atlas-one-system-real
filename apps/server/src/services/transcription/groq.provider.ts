import { WhisperHttpTranscriptionProvider } from "./whisper-http.provider";

export class GroqTranscriptionProvider extends WhisperHttpTranscriptionProvider {
  constructor() {
    super({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY ?? "",
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-large-v3-turbo"
    });
  }
}
