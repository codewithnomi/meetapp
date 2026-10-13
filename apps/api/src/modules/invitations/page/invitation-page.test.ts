// TC-F01-47 (AC-F01-18, 35), the renderer: the valid page shows who invited which masked email to which
// workspace and where to get MeetApp, with no forms or scripts; every unusable invitation gets the same
// page; names are text, never HTML.
import { describe, expect, it } from "vitest";
import { GET_MEETAPP_URL, INVITATION_PAGE_HEADERS, maskEmail, renderInvitationPage } from "./invitation-page.ts";

const EVIL = "<img src=x onerror=alert(1)>";

describe("TC-F01-47 [AC-F01-18] [AC-F01-35] invitation web page", () => {
  it("TC-F01-47 [AC-F01-18] the valid page: workspace, inviter, masked email, get MeetApp; no forms", () => {
    const html = renderInvitationPage({
      page: "valid",
      workspaceName: "Design team",
      inviterName: "Pat Example",
      email: "xavier@example.test",
    });
    expect(html).toContain("Design team");
    expect(html).toContain("Pat Example");
    expect(html).toContain("x***@example.test");
    expect(html).not.toContain("xavier@");
    expect(html).toContain(`href="${GET_MEETAPP_URL}"`);
    expect(html).not.toMatch(/<form|<input|<script|password/i);
  });

  it("TC-F01-47 [AC-F01-35] names are shown as text, in the heading and the body", () => {
    const html = renderInvitationPage({
      page: "valid",
      workspaceName: EVIL,
      inviterName: EVIL,
      email: "x@example.test",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&#60;img src=x onerror=alert(1)&#62;");
  });

  it("TC-F01-47 [AC-F01-18] an unusable invitation says it is no longer valid", () => {
    expect(renderInvitationPage({ page: "invalid" })).toContain(
      "This invitation is no longer valid; ask for a new one.",
    );
  });

  it("TC-F01-47 [AC-F01-18] headers: no caching, no referrer, not indexed, no scripts or forms", () => {
    expect(INVITATION_PAGE_HEADERS["cache-control"]).toBe("no-store");
    expect(INVITATION_PAGE_HEADERS["referrer-policy"]).toBe("no-referrer");
    expect(INVITATION_PAGE_HEADERS["x-robots-tag"]).toBe("noindex");
    const policy = INVITATION_PAGE_HEADERS["content-security-policy"];
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("script-src");
  });

  it("TC-F01-47 [AC-F01-18] masked emails keep the first letter and the domain", () => {
    expect(maskEmail("pat@example.test")).toBe("p***@example.test");
    expect(maskEmail("a@b.test")).toBe("a***@b.test");
  });
});
