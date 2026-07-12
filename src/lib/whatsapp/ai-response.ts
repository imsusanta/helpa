export interface ParsedAiResponse {
  payload: Record<string, unknown> | null;
  reply: string | null;
  isStructured: boolean;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function repairUnicodeEscapes(value: string): string {
  // Some models occasionally produce `\\uud83d` instead of the valid `\\ud83d`.
  return value.replace(/\\u{2,}([0-9a-fA-F]{4})/g, "\\u$1");
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try the repaired JSON next.
  }
  return null;
}

function readReply(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reply = value.trim();
  return reply.length > 0 ? reply : null;
}

function extractReply(value: string): string | null {
  const match = value.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return null;

  for (const candidate of [match[1], repairUnicodeEscapes(match[1])]) {
    try {
      return readReply(JSON.parse(`"${candidate}"`));
    } catch {
      // Continue to the next candidate.
    }
  }

  return null;
}

function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return null;
}

export function parseAiResponse(rawResponse: string): ParsedAiResponse {
  const normalized = stripCodeFence(rawResponse);
  const candidates = [normalized, repairUnicodeEscapes(normalized)];

  for (const candidate of candidates) {
    const payload = parseObject(candidate);
    if (payload) {
      return {
        payload,
        reply: readReply(payload.reply),
        isStructured: true,
      };
    }
  }

  // Fallback: try to extract JSON block from anywhere in the string
  const jsonBlock = extractJson(normalized);
  if (jsonBlock) {
    const repairedJson = repairUnicodeEscapes(jsonBlock);
    for (const candidate of [jsonBlock, repairedJson]) {
      const payload = parseObject(candidate);
      if (payload) {
        return {
          payload,
          reply: readReply(payload.reply),
          isStructured: true,
        };
      }
    }
  }

  const isStructured = normalized.startsWith("{") || normalized.startsWith("[") || (jsonBlock !== null);
  return {
    payload: null,
    reply: isStructured ? (extractReply(normalized) || extractReply(jsonBlock || "")) : readReply(normalized),
    isStructured,
  };
}
