export const MODEL_PRIORITY: Record<string, number> = {
  "gemini-3.7-flash": 0,
  "gemini-3.6-flash": 1,
  "gemini-3.5-flash": 2,
  "gemini-3.5-flash-lite": 3,
  "gemini-3.1-flash-lite": 4,
};

export const EXCLUDED_MODEL_PATTERNS = [
  "image",
  "imagen",
  "video",
  "veo",
  "audio",
  "tts",
  "live",
  "speech",
  "embedding",
  "embed",
  "robotics",
  "-exp",
  "experimental",
  "deprecated",
] as const;

export function isAllowedGeminiModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id.startsWith("gemini-")) return false;
  return !EXCLUDED_MODEL_PATTERNS.some((pattern) => id.includes(pattern));
  }
