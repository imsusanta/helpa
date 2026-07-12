import { describe, expect, it } from "vitest";

import { parseAiResponse } from "./ai-response";

describe("parseAiResponse", () => {
  it("returns a structured reply from valid JSON", () => {
    const result = parseAiResponse('{"reply":"Hello!\\nHow can I help?","intent":"support"}');

    expect(result.reply).toBe("Hello!\nHow can I help?");
    expect(result.payload?.intent).toBe("support");
    expect(result.isStructured).toBe(true);
  });

  it("repairs duplicate unicode escape prefixes before parsing", () => {
    const result = parseAiResponse(
      String.raw`{"reply":"\uud83d\ude0a Hello!\nHow can I help?","intent":"support"}`,
    );

    expect(result.reply).toBe("😊 Hello!\nHow can I help?");
    expect(result.payload?.intent).toBe("support");
  });

  it("extracts only the reply when malformed structured JSON cannot be parsed", () => {
    const result = parseAiResponse(
      String.raw`{"reply":"\uud83d\ude0a Hello!","intent": }`,
    );

    expect(result.reply).toBe("😊 Hello!");
    expect(result.payload).toBeNull();
    expect(result.isStructured).toBe(true);
  });

  it("keeps a plain-text response when the provider does not return JSON", () => {
    const result = parseAiResponse("Hello! How can I help you today?");

    expect(result.reply).toBe("Hello! How can I help you today?");
    expect(result.payload).toBeNull();
    expect(result.isStructured).toBe(false);
  });
});
