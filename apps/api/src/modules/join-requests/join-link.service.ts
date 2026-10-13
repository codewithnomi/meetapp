// Turning the join link and code on and off, replacing them, and copying them (F01 design.md section 5,
// AC-F01-19). Any member may copy them while they are on; only the owner and admins change them.
// Turning on or replacing always makes a new secret, so old links and codes stop at once.
import { ensureAllowed, type Membership } from "../workspaces/workspaces.permissions.ts";
import type { JoinRequestsRepository } from "./join-requests.repository.ts";
import { JOIN_KEY_VERSION, type JoinSecret, type JoinSecrets } from "./join-secret.ts";

interface JoinLinkView {
  enabled: boolean;
  link: string | null;
  code: string | null;
}

const OFF: JoinLinkView = { enabled: false, link: null, code: null };

export function createJoinLinkService(repository: JoinRequestsRepository, secrets: JoinSecrets) {
  const view = (secret: JoinSecret): JoinLinkView => ({
    enabled: true,
    link: secrets.linkOf(secret),
    code: secret.code,
  });

  async function current(workspaceId: string): Promise<JoinSecret | undefined> {
    const state = await repository.joinState(workspaceId);
    if (!state?.enabled || state.encrypted === null || state.keyVersion === null) return undefined;
    return secrets.decrypt(state.encrypted, state.keyVersion);
  }

  async function makeNew(workspaceId: string): Promise<JoinLinkView> {
    const secret = secrets.create();
    const stored = { encrypted: secrets.encrypt(secret), keyVersion: JOIN_KEY_VERSION, ...secrets.hashes(secret) };
    await repository.setJoin(workspaceId, stored);
    return view(secret);
  }

  return {
    async get(membership: Membership): Promise<JoinLinkView> {
      ensureAllowed(membership, "copyJoinLink");
      const secret = await current(membership.workspaceId);
      return secret ? view(secret) : OFF;
    },
    /** On keeps the current link while it is already on; off forgets it. */
    async set(membership: Membership, enabled: boolean): Promise<JoinLinkView> {
      ensureAllowed(membership, "manageJoinLink");
      if (!enabled) {
        await repository.setJoin(membership.workspaceId, undefined);
        return OFF;
      }
      const secret = await current(membership.workspaceId);
      return secret ? view(secret) : makeNew(membership.workspaceId);
    },
    async replace(membership: Membership): Promise<JoinLinkView> {
      ensureAllowed(membership, "manageJoinLink");
      return makeNew(membership.workspaceId);
    },
  };
}

export type JoinLinkService = ReturnType<typeof createJoinLinkService>;
