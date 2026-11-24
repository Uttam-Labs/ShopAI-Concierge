import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getGemini() {
  if (!hasGeminiKey()) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the server environment.");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function embedTexts(texts, taskType) {
  const values = texts.map((value) => String(value || "").trim()).filter(Boolean);
  if (!values.length) return [];
  const result = await getGemini().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: values,
    config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const embeddings = result.embeddings?.map((item) => item.values || []) || [];
  if (embeddings.length !== values.length || embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("Gemini returned embeddings with an unexpected size. Recheck the configured embedding model and dimensions.");
  }
  return embeddings;
}

export async function generateGroundedAnswer({ systemInstruction, prompt, temperature = 0.2 }) {
  const result = await getGemini().models.generateContent({
    model: process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite",
    contents: prompt,
    config: { systemInstruction, temperature, maxOutputTokens: 700 },
  });
  return result.text?.trim() || "";
}
