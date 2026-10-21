// Public entry of @meetapp/db: the schema, connection, migrations, flags and seed data.
export { createDatabase, databaseUrl, type Database, type DatabaseSettings, type Executor } from "./connection.ts";
export { FLAG_KEY_MAX_LENGTH, isValidFlagKey, listFlags, setFlag } from "./flags.ts";
export { MIGRATIONS_FOLDER, migrationCount, runMigrations } from "./migrate.ts";
export {
  account,
  callAttendances,
  chatAttachments,
  chatEvents,
  chatMessages,
  chatPins,
  chatPollOptions,
  chatPollVotes,
  chatPolls,
  chatReactions,
  conversations,
  conversationMembers,
  conversationReads,
  type Conversation,
  type ConversationMember,
  calls,
  featureFlags,
  livekitEvents,
  meetingCoOrganizers,
  meetings,
  invitations,
  joinRequests,
  memberRemovals,
  session,
  user,
  verification,
  workspaceMembers,
  workspaces,
  type Call,
  type CallAttendance,
  type ChatAttachment,
  type ChatMessage,
  type ChatPoll,
  type FeatureFlag,
  type Meeting,
  type User,
} from "./schema.ts";
export { SEED_FLAGS, clearSeed, seedDatabase } from "./seed.ts";
export { SEED_PASSWORD, SEED_PEOPLE, SEED_TEAM } from "./seed-people.ts";
