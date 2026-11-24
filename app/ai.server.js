import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { GoogleGenAI } from "@google/genai";

export const AI_PROVIDERS = ["openai", "gemini", "anthropic"];
const DEFAULT_MODELS = { openai: "gpt-4o-mini", gemini: "gemini-3.8-flash", anthropic: "claude-haiku-4-5-20251001" };

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("API key encryption is not configured. Set SHOPIFY_API_SECRET in the server environment.");
  return createHash("sha256").update(`shopai-provider-key-v1:${secret}`).digest();
}

export function encryptProviderKey(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptProviderKey(value) {
  if (!value) return "";
  try {
    const [version, iv, tag, encrypted] = String(value).split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) return "";
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("AI provider key could not be decrypted", error?.message);
    return "";
  }
}

export function resolveProviderKey(settings) {
  const stored = decryptProviderKey(settings?.aiApiKeyEncrypted);
  if (stored) return stored;
  return settings?.aiProvider === "gemini" ? process.env.GEMINI_API_KEY || "" : "";
}

export function resolveEmbeddingKey(settings) {
  if (settings?.aiProvider === "gemini") return resolveProviderKey(settings);
  return process.env.GEMINI_API_KEY || "";
}

async function requestJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error?.message || body.message || `Provider returned HTTP ${response.status}.`;
    throw new Error(message.slice(0, 400));
  }
  return body;
}

export async function generateProviderAnswer({ provider, apiKey, systemInstruction, prompt, temperature = 0.2, maxOutputTokens = 500 }) {
  if (!AI_PROVIDERS.includes(provider)) throw new Error("Choose a supported AI provider.");
  if (!apiKey) throw new Error(`Add a ${provider} API key in Assistant settings.`);
  if (provider === "gemini") {
    const client = new GoogleGenAI({ apiKey });
    const configuredModel = process.env.GEMINI_CHAT_MODEL;
    const models = configuredModel && configuredModel !== DEFAULT_MODELS.gemini ? [configuredModel, DEFAULT_MODELS.gemini] : [DEFAULT_MODELS.gemini];
    let lastError;
    for (const model of models) {
      try {
        const result = await client.models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction, temperature, maxOutputTokens, thinkingConfig: { thinkingLevel: "LOW" } },
        });
        return result.text?.trim() || "";
      } catch (error) {
        lastError = error;
        const message = String(error?.message || "");
        if (model === DEFAULT_MODELS.gemini || !/(404|not found|not available|no longer available|model.*not)/i.test(message)) throw error;
        console.warn(`Gemini model ${model} is unavailable; retrying with ${DEFAULT_MODELS.gemini}.`);
      }
    }
    throw lastError;
  }
  if (provider === "openai") {
    const data = await requestJson("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: DEFAULT_MODELS.openai, temperature, max_tokens: maxOutputTokens, messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }] }),
    });
    return data.choices?.[0]?.message?.content?.trim() || "";
  }
  const data = await requestJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: DEFAULT_MODELS.anthropic, max_tokens: maxOutputTokens, temperature, system: systemInstruction, messages: [{ role: "user", content: prompt }] }),
  });
  return data.content?.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim() || "";
}

export async function verifyProviderKey(provider, apiKey) {
  const text = await generateProviderAnswer({
    provider,
    apiKey,
    systemInstruction: "Reply with exactly: connected",
    prompt: "Reply with exactly: connected",
    temperature: 0,
    maxOutputTokens: 128,
  });
  if (!text) throw new Error("The provider returned an empty reply. Check the key and model access.");
  return true;
}

export function providerKeyError(error, provider) {
  let message = String(error?.message || "");
  try {
    const parsed = JSON.parse(message);
    message = parsed.error?.message || parsed.message || message;
  } catch { /* Provider errors are often plain text. */ }
  if (/401|403|unauthorized|invalid.*key|authentication|api key/i.test(message)) return `That ${provider} API key was rejected. Check the key and try again.`;
  if (/429|quota|billing|rate.?limit/i.test(message)) return `${provider} accepted the key but its quota or billing limit was reached. Check the provider account.`;
  if (/timeout|timed out|abort/i.test(message)) return `Could not reach ${provider} right now. Try saving again in a moment.`;
  if (provider === "gemini" && /(404|not found|not available|no longer available|model.*not)/i.test(message)) return "Your Gemini key was reached, but its chat model is unavailable. The app now tries Gemini 3.8 Flash automatically; check that this model is enabled for your Google AI Studio project.";
  return `Could not connect to ${provider}: ${message.slice(0, 220) || "check the API key and model access"}`;
}
