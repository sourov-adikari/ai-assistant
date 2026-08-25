import type { IncomingMessage, ServerResponse } from "node:http";
import { EXCLUDED_MODEL_PATTERNS, MODEL_PRIORITY } from "../src/lib/model-config";

type ApiRequest = IncomingMessage & { method?: string; socket?: { remoteAddress?: string } };
type ApiResponse = ServerResponse<IncomingMessage>;
type GeminiModel = { name?: unknown; displayName?: unknown; display_name?: unknown; description?: unknown; supportedGenerationMethods?: unknown; supported_generation_methods?: unknown; outputModalities?: unknown };
type PublicModel = { id: string; displayName: string; description: string; type: "text" };
type Cache = { expiresAt: number; models: PublicModel[] };

const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const DISCOVERY_TIMEOUT_MS = 5000;
let cache: Cache | null = null;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function json(res: ApiResponse, status: number, body: unknown): void { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); }
function getClientKey(req: ApiRequest): string {
  const forwarded = (req as IncomingMessage & { headers?: Record<string, string | string[] | undefined> }).headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return String(firstForwarded || req.socket?.remoteAddress || "unknown").trim().slice(0, 128) || "unknown";
}
function allowed(req: ApiRequest): { ok: boolean; retryAfter: number } {
  const now = Date.now(), key = getClientKey(req), current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) { requestWindows.set(key, { startedAt: now, count: 1 }); return { ok: true, retryAfter: 0 }; }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return { ok: false, retryAfter: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.startedAt)) / 1000)) };
  current.count += 1; return { ok: true, retryAfter: 0 };
}
function normalizeModel(model: GeminiModel): PublicModel | null {
  const id = String(model.name || "").replace(/^models\//i, "").trim();
  if (!id) return null;
  const lower = id.toLowerCase();
  if (EXCLUDED_MODEL_PATTERNS.some((pattern) => lower.includes(pattern))) return null;
  const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : Array.isArray(model.supported_generation_methods) ? model.supported_generation_methods : [];
  if (!methods.some((method) => String(method).toLowerCase() === "generatecontent")) return null;
  if (Array.isArray(model.outputModalities) && !model.outputModalities.some((value) => String(value).toLowerCase() === "text")) return null;
  return { id, displayName: String(model.displayName || model.display_name || id), description: String(model.description || ""), type: "text" };
}

export default async function modelsHandler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); json(res, 405, { error: "Method Not Allowed" }); return; }
  const limit = allowed(req);
  if (!limit.ok) { res.setHeader("Retry-After", String(limit.retryAfter)); json(res, 429, { error: "Too many model requests. Please try again shortly." }); return; }
  if (cache && cache.expiresAt > Date.now()) { res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300"); json(res, 200, { models: cache.models }); return; }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { json(res, 500, { error: "GEMINI_API_KEY is not configured." }); return; }
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { method: "GET", headers: { "x-goog-api-key": apiKey, Accept: "application/json" }, signal: controller.signal });
    const data = (await response.json()) as { models?: GeminiModel[]; error?: { message?: string } };
    if (!response.ok) { console.error("Gemini models API error:", data); json(res, response.status >= 500 ? 502 : response.status, { error: data?.error?.message || "Gemini model discovery failed." }); return; }
    const models = Array.isArray(data.models) ? data.models.map(normalizeModel).filter((model): model is PublicModel => model !== null) : [];
    const uniqueModels = Array.from(new Map(models.map((model) => [model.id, model])).values());
    uniqueModels.sort((a, b) => { const priorityA = MODEL_PRIORITY[a.id] ?? 99, priorityB = MODEL_PRIORITY[b.id] ?? 99; return priorityA - priorityB || a.displayName.localeCompare(b.displayName); });
    if (uniqueModels.length === 0) { json(res, 503, { error: "Gemini returned no text models that support generateContent for this API key." }); return; }
    cache = { models: uniqueModels, expiresAt: Date.now() + CACHE_TTL_MS };
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300"); json(res, 200, { models: uniqueModels });
  } catch (error) { console.error("Model Discovery Error:", error); res.setHeader("Cache-Control", "no-store"); json(res, 503, { error: "Unable to discover Gemini models right now. Please try again." }); }
  finally { clearTimeout(timeout); }
}
