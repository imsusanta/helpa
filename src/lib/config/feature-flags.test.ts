import { describe, it, expect, afterEach } from "vitest";

import { isMcpServerEnabled, isCampaignsCronEnabled } from "./feature-flags";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("feature flags fail closed", () => {
  describe.each([
    ["ENABLE_MCP_SERVER", isMcpServerEnabled],
    ["ENABLE_CAMPAIGNS_CRON", isCampaignsCronEnabled],
  ])("%s", (envVar, read) => {
    it("is off when the variable is unset", () => {
      delete process.env[envVar];
      expect(read()).toBe(false);
    });

    it.each(["", "false", "0", "off", "no", "TRUE1", "true-ish", "1", "yes"])(
      "is off for %j",
      (value) => {
        process.env[envVar] = value;
        expect(read()).toBe(false);
      },
    );

    it.each(["true", "TRUE", " true ", "True"])("is on for %j", (value) => {
      process.env[envVar] = value;
      expect(read()).toBe(true);
    });
  });
});
