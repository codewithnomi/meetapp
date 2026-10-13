// Creating an account with an emailed code (F01 T5, AC-F01-01, 02, 04, 14, 29): the account exists only
// after the right code; an existing email gets the same answer and its owner a notice; a second sign-up
// can't take over the first; one transaction makes the user, the password login and the personal
// workspace. Runs on its own database with real emails in Mailpit; needs the `pnpm dev` services.
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { countEmails, latestCode, waitForEmail } from "../../test-support/mailpit.ts";

const PASSWORD = "correct horse battery";
const SLOW = { timeout: 90_000 };
let t: AuthTestApp;

beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

afterEach(() => {
  vi.useRealTimers();
});

const ORIGIN = { origin: "app://meetapp" };
const post = (url: string, payload: object) => t.app.inject({ method: "POST", url, payload, headers: ORIGIN });
const startSignUp = (email: string, extra: object = {}) =>
  post("/api/v1/auth/sign-up", { email, name: "New Person", password: PASSWORD, termsAccepted: true, ...extra });
const verify = (signupId: string, code: string) => post("/api/v1/auth/sign-up/verify", { signupId, code });

async function rows(query: ReturnType<typeof sql>) {
  return (await t.database.db.execute(query)).rows;
}
const usersWith = async (email: string) =>
  Number((await rows(sql`select count(*)::int as n from "user" where email = ${email}`))[0]?.["n"]);

/** Starts a sign-up and returns its id and the emailed code. */
async function started(email: string, extra: object = {}) {
  const since = new Date(Date.now() - 1_000);
  const response = await startSignUp(email, extra);
  expect(response.statusCode).toBe(202);
  const { signupId } = response.json<{ signupId: string }>();
  return { signupId, code: await latestCode(email, since) };
}

describe("TC-F01-02 [AC-F01-01] starting a sign-up", () => {
  it("TC-F01-02 [AC-F01-01] answers 202 with a sign-up id, emails a code, and creates no user yet", SLOW, async () => {
    const email = testEmail("start");
    const { code } = await started(email);
    expect(code).toMatch(/^\d{6}$/);
    expect(await usersWith(email)).toBe(0);
  });

  it("TC-F01-02 [AC-F01-01] after the code the user has the terms version and dates", SLOW, async () => {
    const email = testEmail("terms");
    const { signupId, code } = await started(email);
    expect((await verify(signupId, code)).statusCode).toBe(200);
    const [user] = await rows(
      sql`select terms_version, terms_accepted_at, age_confirmed_at, email_verified from "user" where email = ${email}`,
    );
    expect(user).toMatchObject({ terms_version: "draft-1", email_verified: true });
    expect(user?.["terms_accepted_at"]).not.toBeNull();
    expect(user?.["age_confirmed_at"]).not.toBeNull();
  });
});

describe("TC-F01-03 [AC-F01-01] sign-up without the tick", () => {
  it.each([[{ termsAccepted: false }], [{ termsAccepted: "true" }], [{ termsAccepted: undefined }]])(
    "TC-F01-03 [AC-F01-01] %j is refused with a field error and sends nothing",
    async (terms) => {
      const email = testEmail("no-tick");
      const since = new Date(Date.now() - 1_000);
      const response = await post("/api/v1/auth/sign-up", { email, name: "X", password: PASSWORD, ...terms });
      expect(response.statusCode).toBe(400);
      expect(JSON.stringify(response.json())).toContain("termsAccepted");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(await countEmails(email, since)).toBe(0);
    },
  );

  it("TC-F01-06 [AC-F01-03] a weak password is refused at sign-up with the reason", async () => {
    const response = await startSignUp(testEmail("weak"), { password: "password123" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "PASSWORD_WEAK", message: expect.stringContaining("common") },
    });
  });
});

describe("TC-F01-04 [AC-F01-02] an email that already has an account", () => {
  it(
    "TC-F01-04 [AC-F01-02] gets the same answer, no code and no second account; the owner is told once an hour",
    SLOW,
    async () => {
      const owner = testEmail("owner");
      await createUser(t.auth, { email: owner, password: PASSWORD });
      const since = new Date(Date.now() - 1_000);
      const first = await startSignUp(owner);
      const fresh = await startSignUp(testEmail("fresh"));
      expect(first.statusCode).toBe(fresh.statusCode);
      expect(Object.keys(first.json<object>()).sort()).toEqual(Object.keys(fresh.json<object>()).sort());
      const notice = await waitForEmail(owner, { since, subject: /tried to create/ });
      expect(notice.Subject).toMatch(/Someone tried to create a MeetApp account/);
      await startSignUp(owner);
      await startSignUp(owner);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      expect(await countEmails(owner, since)).toBe(1);
      expect(await usersWith(owner)).toBe(1);
    },
  );
});

describe("TC-F01-05 [AC-F01-02] [AC-F01-33] a second sign-up can't take over the first", () => {
  it("TC-F01-05 [AC-F01-04] the victim's password and name win; the attacker's code is invalid", SLOW, async () => {
    const email = testEmail("contested");
    const victim = await started(email, { name: "Victim", password: PASSWORD });
    const attacker = await started(email, { name: "Attacker", password: "attacker password 9" });
    expect(attacker.signupId).not.toBe(victim.signupId);
    expect((await verify(victim.signupId, victim.code)).statusCode).toBe(200);
    const late = await verify(attacker.signupId, attacker.code);
    expect(late.json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    const [user] = await rows(sql`select name from "user" where email = ${email}`);
    expect(user?.["name"]).toBe("Victim");
    const asAttacker = await post("/api/auth/sign-in/email", { email, password: "attacker password 9" });
    expect(asAttacker.statusCode).toBe(401);
    expect((await post("/api/auth/sign-in/email", { email, password: PASSWORD })).statusCode).toBe(200);
  });
});

describe("TC-F01-07 [AC-F01-04] [AC-F01-14] the right code makes everything in one step", () => {
  it("TC-F01-07 [AC-F01-04] user, password login, look, one personal workspace and a session", SLOW, async () => {
    const email = testEmail("complete");
    const { signupId, code } = await started(email, { theme: "dark", accent: "teal" });
    const response = await verify(signupId, code);
    expect(response.statusCode).toBe(200);
    const token = response.headers["set-auth-token"];
    expect(token).toEqual(expect.any(String));
    const me = await t.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${String(token)}` } });
    expect(me.json()).toMatchObject({ user: { email, theme: "dark", accent: "teal", termsAccepted: true } });
    const workspaces = await rows(sql`
      select w.kind, w.name, m.role from workspaces w join workspace_members m on m.workspace_id = w.id
      join "user" u on u.id = m.user_id where u.email = ${email}`);
    expect(workspaces).toEqual([{ kind: "personal", name: "Personal", role: "owner" }]);
    expect((await verify(signupId, code)).json()).toMatchObject({ error: { code: "CODE_INVALID" } });
  });

  it("TC-F01-07 [AC-F01-14] if the personal workspace can't be made, no user is left behind", SLOW, async () => {
    const email = testEmail("rollback");
    const { signupId, code } = await started(email);
    await t.database.db.execute(
      sql.raw(`
      create function fail_personal() returns trigger language plpgsql as $$ begin raise exception 'forced'; end $$;
      create trigger fail_personal before insert on workspaces for each row
        when (new.kind = 'personal') execute function fail_personal();`),
    );
    try {
      expect((await verify(signupId, code)).statusCode).toBe(500);
    } finally {
      await t.database.db.execute(sql.raw("drop trigger fail_personal on workspaces; drop function fail_personal();"));
    }
    expect(await usersWith(email)).toBe(0);
  });
});

describe("TC-F01-08 [AC-F01-04] wrong, used, expired and exhausted codes", () => {
  const wrongOf = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

  it("TC-F01-08 [AC-F01-04] a wrong code is refused; after 5 wrong codes even the right one is", SLOW, async () => {
    const email = testEmail("wrong");
    const { signupId, code } = await started(email);
    expect((await verify(signupId, wrongOf(code))).json()).toMatchObject({
      error: { code: "CODE_INVALID", message: "That code isn't right." },
    });
    for (let attempt = 2; attempt <= 5; attempt++) await verify(signupId, wrongOf(code));
    expect((await verify(signupId, code)).json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    expect(await usersWith(email)).toBe(0);
  });

  it("TC-F01-08 [AC-F01-04] a code used after 15 minutes is refused as expired", SLOW, async () => {
    const { signupId, code } = await started(testEmail("late"));
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 15 * 60 * 1_000 + 1_000 });
    expect((await verify(signupId, code)).json()).toMatchObject({ error: { code: "CODE_EXPIRED" } });
  });

  it("TC-F01-08 [AC-F01-04] Send a new code: the new one works, the old one doesn't", SLOW, async () => {
    const email = testEmail("resend");
    const first = await started(email);
    const since = new Date(Date.now() - 1_000);
    expect((await post("/api/v1/auth/sign-up/resend", { signupId: first.signupId })).statusCode).toBe(202);
    // Wait for the new code (the first email may still be the newest for a moment).
    let second = first.code;
    const deadline = Date.now() + 10_000;
    while (second === first.code && Date.now() < deadline) second = await latestCode(email, since);
    expect(second).not.toBe(first.code);
    expect((await verify(first.signupId, first.code)).json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    expect((await verify(first.signupId, second)).statusCode).toBe(200);
  });
});

describe("TC-F01-09 [AC-F01-04] [AC-F01-29] double submits make one account", () => {
  it(
    "TC-F01-09 [AC-F01-29] two right codes at the same moment, and one verify sent twice, make one user",
    SLOW,
    async () => {
      const email = testEmail("double");
      const a = await started(email);
      const b = await started(email);
      const answers = await Promise.all([
        verify(a.signupId, a.code),
        verify(b.signupId, b.code),
        verify(a.signupId, a.code),
      ]);
      expect(answers.filter((answer) => answer.statusCode === 200)).toHaveLength(1);
      for (const loser of answers.filter((answer) => answer.statusCode !== 200)) {
        expect(loser.json()).toMatchObject({ error: { code: "CODE_INVALID" } });
      }
      expect(await usersWith(email)).toBe(1);
      const personal = await rows(sql`
      select count(*)::int as n from workspaces w join "user" u on u.id = w.created_by
      where u.email = ${email} and w.kind = 'personal'`);
      expect(personal[0]?.["n"]).toBe(1);
    },
  );

  it(
    "TC-F01-09 [AC-F01-02] for an email that already has an account, verify always says the code is wrong",
    SLOW,
    async () => {
      const owner = testEmail("has-account");
      await createUser(t.auth, { email: owner, password: PASSWORD });
      const response = await startSignUp(owner);
      const { signupId } = response.json<{ signupId: string }>();
      for (let attempt = 0; attempt < 3; attempt++) {
        const guess = String(attempt * 111_111).padStart(6, "0");
        expect((await verify(signupId, guess)).json()).toMatchObject({ error: { code: "CODE_INVALID" } });
      }
    },
  );
});

describe("TC-F01-06 [AC-F01-04, AC-F01-13] code tries can't be raced, security", () => {
  it(
    "TC-F01-06 [AC-F01-04, AC-F01-13] 20 wrong guesses sent at once all count: the right code is refused after",
    SLOW,
    async () => {
      const email = testEmail("race");
      const { signupId, code } = await started(email);
      const wrong = code === "000000" ? "111111" : "000000";
      const guesses = await Promise.all(Array.from({ length: 20 }, () => verify(signupId, wrong)));
      expect(guesses.every((answer) => answer.statusCode === 400)).toBe(true);
      const right = await verify(signupId, code);
      expect(right.statusCode).toBe(400);
      expect(right.json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    },
  );
});

describe("TC-F01-37 [AC-F01-14] every new account has exactly one personal workspace", () => {
  it(
    "TC-F01-37 [AC-F01-14] GET /me repairs a missing personal workspace once, even when called twice at once",
    SLOW,
    async () => {
      const email = testEmail("repair");
      const { signupId, code } = await started(email);
      const token = String((await verify(signupId, code)).headers["set-auth-token"]);
      await t.database.db.execute(sql`
      delete from workspaces where kind = 'personal' and created_by = (select id from "user" where email = ${email})`);
      const headers = { authorization: `Bearer ${token}` };
      const both = await Promise.all([
        t.app.inject({ url: "/api/v1/me", headers }),
        t.app.inject({ url: "/api/v1/me", headers }),
      ]);
      expect(both.map((answer) => answer.statusCode)).toEqual([200, 200]);
      const personal = await rows(sql`
      select count(*)::int as n from workspaces w join "user" u on u.id = w.created_by
      where u.email = ${email} and w.kind = 'personal'`);
      expect(personal[0]?.["n"]).toBe(1);
    },
  );

  it(
    "TC-F01-37 [AC-F01-14] a personal workspace left without its membership is repaired by GET /me",
    SLOW,
    async () => {
      const email = testEmail("half-made");
      const { signupId, code } = await started(email);
      const token = String((await verify(signupId, code)).headers["set-auth-token"]);
      await t.database.db.execute(sql`
      delete from workspace_members where workspace_id in (
        select w.id from workspaces w join "user" u on u.id = w.created_by where u.email = ${email} and w.kind = 'personal')`);
      const me = await t.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${token}` } });
      expect(me.json<{ workspaces: { kind: string; role: string }[] }>().workspaces).toEqual([
        expect.objectContaining({ kind: "personal", role: "owner" }),
      ]);
    },
  );
});
