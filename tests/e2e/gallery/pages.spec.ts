// TC-F01-71 (AC-F01-28): the invitation web page the API serves (valid, no longer valid, too many
// tries) has zero accessibility problems, checked with every axe rule since it is a whole page.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { renderInvitationPage } from "../../../apps/api/src/modules/invitations/page/invitation-page.ts";

const PAGES = {
  valid: renderInvitationPage({
    page: "valid",
    workspaceName: "Example team",
    inviterName: "Example Owner",
    email: "member@example.test",
  }),
  invalid: renderInvitationPage({ page: "invalid" }),
  busy: renderInvitationPage({ page: "busy" }),
};

for (const [name, html] of Object.entries(PAGES)) {
  test(`invitation page (${name}) has no accessibility problems`, async ({ page }) => {
    await page.setContent(html);
    const results = await new AxeBuilder({ page }).analyze();
    const problems = results.violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} (${violation.help})`),
    );
    expect(problems).toEqual([]);
  });
}
