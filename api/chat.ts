import type { IncomingMessage, ServerResponse } from "node:http";
import { isAllowedGeminiModel } from "../src/lib/model-config";

const MAX_HISTORY_MESSAGES = 50;
const MAX_TEXT_LENGTH = 20_000;
const MAX_INSTRUCTION_LENGTH = 8_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

const RESPONSE_QUALITY_INSTRUCTION = `
You are the response engine for a polished personal AI assistant. Your responses should feel natural, helpful, concise, and professionally formatted, similar to a high-quality conversational AI assistant.

GENERAL
- Answer the user's actual request directly. Match the user's language and tone.
- Be conversational and human-readable, not like a textbook, report, or generated template.
- Match response length to the user's request.
- Never invent facts, APIs, package names, model capabilities, sources, or test results.
- Do not expose hidden chain-of-thought or private reasoning.

INTELLIGENT MARKDOWN — IMPORTANT
- Use Markdown naturally, not mechanically.
- Do not force headings, lists, bold text, tables, or numbered sections into every response.
- Use headings only for genuinely separate topics.
- Use bullets for related items and numbered lists for ordered steps.
- Use bold sparingly.
- Use tables only when they materially improve comparison or structured data.
- Preserve the user's requested format.

MATHEMATICS / SCIENCE
- Verify algebra, arithmetic, units, and scientific statements.
- Use LaTeX when mathematical notation genuinely benefits from it.
- Use inline math with $...$ and display math with $$...$$.
- Never put mathematical derivations inside code fences.
- If information is missing or ambiguous, say exactly what is missing instead of guessing.

PROGRAMMING / CODE
- Use fenced Markdown code blocks with an explicit language.
- Keep code clean, focused, and runnable whenever possible.
- Explain important decisions outside code blocks.
- Preserve indentation and syntax.
- Do not replace required code with unexplained placeholders.

TECHNICAL / DATA
- Use bullets for actionable steps and feature lists.
- Use Markdown tables for meaningful comparisons.
- Use JSON/code fences for JSON and configuration.
- Distinguish facts from recommendations and clearly state uncertainty.

FINAL QUALITY CHECK
Before responding, mentally check whether this is the simplest clear format for the question. Remove unnecessary structure and filler.
`;

type ChatPart = { text: string };
type ChatContent = { role: "user" | "model"; parts: ChatPart[] };
type ChatRequestBody = { message?: unknown; modelName?: unknown; history?: unknown; systemInstruction?: unknown };
type ApiResponse = ServerResponse<IncomingMessage> & { flushHeaders?: () => void };
type RequestWithBody = IncomingMessage & { method?: string; body?: ChatRequestBody; socket?: { remoteAddress?: string } };

function normalizeModelName(value: unknown): string { return String(value || "").trim().replace(/^models\//i, "").toLowerCase(); }
function getClientKey(req: RequestWithBody): string {
  const forwarded = (req as IncomingMessage & { headers?: Record<string, string | string[] | undefined> }).headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return String(firstForwarded || req.socket?.remoteAddress || "unknown").trim().slice(0, 128) || "unknown";
}
function checkRateLimit(req: RequestWithBody): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now(), key = getClientKey(req), current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) { requestWindows.set(key, { startedAt: now, count: 1 }); return { allowed: true, retryAfterSeconds: 0 }; }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.startedAt)) / 1000)) };
  current.count += 1; return { allowed: true, retryAfterSeconds: 0 };
}
function cleanupRateLimitMap(): void { if (requestWindows.size < 500) return; const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS; for (const [key, value] of requestWindows) if (value.startedAt < cutoff) requestWindows.delete(key); }
function sanitizeHistory(history: unknown): ChatContent[] {
  if (!Array.isArray(history)) return [];
  return history.filter((item): item is { role: string; parts: unknown[] } => Boolean(item) && typeof item === "object" && ["user", "model"].includes(String((item as { role?: unknown }).role)) && Array.isArray((item as { parts?: unknown }).parts)).map((item) => {
    const text = item.parts.filter((part): part is { text: string } => Boolean(part) && typeof part === "object" && typeof (part as { text?: unknown }).text === "string").map((part) => part.text).join("\n").trim().slice(0, MAX_TEXT_LENGTH);
    return { role: item.role as "user" | "model", parts: [{ text }] };
  }).filter((item) => item.parts[0].text).slice(-MAX_HISTORY_MESSAGES);
}
function json(res: ApiResponse, status: number, body: unknown): void { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); }
function sendSSE(res: ApiResponse, payload: unknown): boolean { if (res.writableEnded || res.destroyed) return false; res.write(`data: ${JSON.stringify(payload)}\n\n`); return true; }
function sendDone(res: ApiResponse): void { if (!res.writableEnded && !res.destroyed) res.write("data: [DONE]\n\n"); }
function extractTextFromChunk(chunk: unknown): string {
  const parts = (chunk as { candidates?: Array<{ content?: { parts?: unknown[] } }> } | null)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((part): part is { text: string; thought?: boolean } => Boolean(part) && typeof part === "object" && (part as { thought?: unknown }).thought !== true && typeof (part as { text?: unknown }).text === "string").map((part) => part.text).join("");
}
function getGeminiErrorMessage(data: unknown): string {
  if (data && typeof data === "object") { const error = (data as { error?: { message?: unknown } }).error; if (typeof error?.message === "string") return error.message; const message = (data as { message?: unknown }).message; if (typeof message === "string") return message; }
  return "Gemini request failed.";
}
function getUserFacingGeminiError(status: number, rawMessage: string): string {
  if (status === 429) return "This model is temporarily rate-limited or has reached its current quota. Please wait a moment or choose another available model.";
  if (status === 401 || status === 403) return "The AI service is not authorized correctly. Please try again later.";
  if (status >= 500) return "The AI service is temporarily unavailable. Please try again shortly.";
  return rawMessage || `Gemini returned HTTP ${status}.`;
}
function processSSEBuffer(buffer: string, onData: (data: string) => void): string {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events = normalized.split("\n\n");
  const remainder = events.pop() || "";
  for (const event of events) {
    const dataLines = event.split("\n").filter((line) => line.startsWith("data:"));
    if (!dataLines.length) continue;
    const data = dataLines.map((line) => line.slice(5).trim()).join("\n");
    if (data) onData(data);
  }
  return remainder;
}

export default async function chatHandler(req: RequestWithBody, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); json(res, 405, { error: "Method Not Allowed" }); return; }
  cleanupRateLimitMap(); const limit = checkRateLimit(req);
  if (!limit.allowed) { res.setHeader("Retry-After", String(limit.retryAfterSeconds)); json(res, 429, { error: `Too many requests. Please try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`, retryAfterSeconds: limit.retryAfterSeconds }); return; }
  const apiKey = process.env.GEMINI_API_KEY; if (!apiKey) { json(res, 500, { error: "GEMINI_API_KEY is not configured." }); return; }
  const body = req.body ?? {}, message = body.message, modelName = normalizeModelName(body.modelName);
  if (typeof message !== "string" || !message.trim()) { json(res, 400, { error: "Message is required." }); return; }
  if (!isAllowedGeminiModel(modelName)) { json(res, 400, { error: "This model is not supported by the text assistant. Please choose a currently supported text model." }); return; }
  const contents: ChatContent[] = [...sanitizeHistory(body.history), { role: "user", parts: [{ text: message.trim().slice(0, MAX_TEXT_LENGTH) }] }];
  const clientInstruction = typeof body.systemInstruction === "string" ? body.systemInstruction.trim().slice(0, MAX_INSTRUCTION_LENGTH) : "";
  const systemInstruction = [RESPONSE_QUALITY_INSTRUCTION.trim(), clientInstruction].filter(Boolean).join("\n\nADDITIONAL ASSISTANT PERSONA:\n");
  const requestBody = { systemInstruction: { parts: [{ text: systemInstruction }] }, contents };
  res.statusCode = 200; res.setHeader("Content-Type", "text/event-stream; charset=utf-8"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.setHeader("X-Accel-Buffering", "no"); res.setHeader("X-Content-Type-Options", "nosniff"); res.flushHeaders?.();
  let disconnected = false;
  const onAborted = () => { disconnected = true; }, onResponseClose = () => { disconnected = true; };
  req.on("aborted", onAborted); res.on("close", onResponseClose);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey, Accept: "text/event-stream" }, body: JSON.stringify(requestBody), signal: controller.signal });
    if (!upstream.ok) {
      const errorText = await upstream.text(); let errorData: unknown = null; try { errorData = JSON.parse(errorText); } catch {}
      const rawMessage = getGeminiErrorMessage(errorData); console.error("[Gemini] HTTP error:", upstream.status, errorText);
      if (!disconnected) { sendSSE(res, { error: getUserFacingGeminiError(upstream.status, rawMessage), status: upstream.status, retryable: upstream.status === 429 || upstream.status >= 500 }); sendDone(res); } return;
    }
    if (!upstream.body) { if (!disconnected) { sendSSE(res, { error: "The AI service returned an empty response.", retryable: true }); sendDone(res); } return; }
    const reader = upstream.body.getReader(), decoder = new TextDecoder(); let buffer = "";
    while (!disconnected) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = processSSEBuffer(buffer, (data) => {
        if (data === "[DONE]") return;
        try { const text = extractTextFromChunk(JSON.parse(data)); if (text) sendSSE(res, { text }); }
        catch (error) { console.warn("[Gemini] Ignoring malformed SSE event:", error); }
      });
    }
    buffer += decoder.decode();
    processSSEBuffer(buffer + "\n\n", (data) => {
      if (data === "[DONE]") return;
      try { const text = extractTextFromChunk(JSON.parse(data)); if (text) sendSSE(res, { text }); }
      catch (error) { console.warn("[Gemini] Ignoring malformed final SSE event:", error); }
    });
    if (!disconnected) sendDone(res);
  } catch (error) {
    if (!disconnected) { const timedOut = error instanceof DOMException && error.name === "AbortError"; sendSSE(res, { error: timedOut ? "The AI response took too long. Please try again or choose another model." : "The AI service could not complete the response.", retryable: true, timeout: timedOut }); sendDone(res); }
  } finally { clearTimeout(timeout); req.off("aborted", onAborted); res.off("close", onResponseClose); }
}
