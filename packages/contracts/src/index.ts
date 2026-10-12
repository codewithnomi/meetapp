// Shared request/response schemas (Zod) used by the backend and the apps; the source of the OpenAPI file.
export { ERROR_CODES, errorResponseSchema, type ErrorCode, type ErrorResponse } from "./errors.ts";
export { healthCheckStateSchema, healthResponseSchema, type HealthResponse } from "./health.ts";
export { flagSchema, flagsResponseSchema, type Flag } from "./flags.ts";
export {
  ACCENT_CHOICES,
  THEME_CHOICES,
  acceptTermsBodySchema,
  changePasswordBodySchema,
  lastWorkspaceBodySchema,
  meResponseSchema,
  resetPasswordBodySchema,
  signUpBodySchema,
  signUpResendBodySchema,
  signUpResentSchema,
  signUpStartedSchema,
  signUpVerifyBodySchema,
  type MeResponse,
} from "./accounts.ts";
export {
  SIGN_IN_PROVIDERS,
  desktopExchangeBodySchema,
  desktopInitBodySchema,
  desktopInitResponseSchema,
  desktopPendingSchema,
  providersResponseSchema,
  type SignInProvider,
} from "./desktop-sign-in.ts";
export {
  MEMBER_ROLES,
  WORKSPACE_ACTIONS,
  WORKSPACE_KINDS,
  changeRoleBodySchema,
  createWorkspaceBodySchema,
  idempotencyHeadersSchema,
  memberParamsSchema,
  membersResponseSchema,
  renameWorkspaceBodySchema,
  transferBodySchema,
  workspaceCreatedSchema,
  workspaceNameSchema,
  workspaceParamsSchema,
  workspaceSchema,
  type MemberRole,
  type MembersResponse,
  type WorkspaceAction,
  type WorkspaceSummary,
} from "./workspaces.ts";
export {
  invitationAcceptedSchema,
  invitationCreatedSchema,
  invitationParamsSchema,
  inviteBodySchema,
  myInvitationParamsSchema,
  myInvitationsResponseSchema,
  sentInvitationsResponseSchema,
} from "./invitations.ts";
export {
  joinLinkSchema,
  joinLookupResponseSchema,
  joinRequestParamsSchema,
  joinRequestResponseSchema,
  joinRequestsResponseSchema,
  linkOrCodeBodySchema,
  setJoinLinkBodySchema,
} from "./join.ts";
