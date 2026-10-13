// TC-F01-22 (AC-F01-08): which Google/Microsoft emails count as verified.
import { describe, expect, it } from "vitest";
import { MICROSOFT_CONSUMER_TENANT, googleEmailVerified, microsoftEmailVerified } from "./provider-profile.ts";

const WORK_TENANT = "11111111-2222-3333-4444-555555555555";

describe("TC-F01-22 [AC-F01-08] verified provider emails only", () => {
  it("TC-F01-22 [AC-F01-08] Google: only email_verified true counts", () => {
    expect(googleEmailVerified({ email: "a@example.test", email_verified: true })).toBe(true);
    expect(googleEmailVerified({ email: "a@example.test", email_verified: false })).toBe(false);
    expect(googleEmailVerified({ email: "a@example.test", email_verified: "true" })).toBe(false);
    expect(googleEmailVerified({ email: "a@example.test" })).toBe(false);
    expect(googleEmailVerified({ email_verified: true })).toBe(false);
  });

  it("TC-F01-22 [AC-F01-08] Microsoft: xms_edov true, or a personal (consumer) account", () => {
    expect(microsoftEmailVerified({ email: "a@example.test", tid: WORK_TENANT, xms_edov: true })).toBe(true);
    expect(microsoftEmailVerified({ email: "a@example.test", tid: WORK_TENANT, xms_edov: false })).toBe(false);
    expect(microsoftEmailVerified({ email: "a@example.test", tid: WORK_TENANT })).toBe(false);
    expect(microsoftEmailVerified({ email: "a@example.test", tid: MICROSOFT_CONSUMER_TENANT })).toBe(true);
    expect(microsoftEmailVerified({ tid: MICROSOFT_CONSUMER_TENANT })).toBe(false);
  });
});
