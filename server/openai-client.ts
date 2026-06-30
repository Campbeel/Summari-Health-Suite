import OpenAI from "openai";

let client: OpenAI | undefined;

export function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim()
  );
}

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OpenAI no está configurado. Agrega AI_INTEGRATIONS_OPENAI_API_KEY en tu archivo .env",
    );
  }

  client = new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return client;
}
