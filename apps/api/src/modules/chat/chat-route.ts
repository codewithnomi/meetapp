// Shared by the chat route files (F03 design.md section 8): every chat route takes the meeting ticket.
import { meetingTicketHeadersSchema } from "@meetapp/contracts";

const TICKET =
  "Needs the meeting ticket (X-Meeting-Ticket) of someone in this call whose role allows it; otherwise 404.";

/** A chat route's settings: ticket-authenticated, documented under "chat". */
export const chatRoute = <S extends object>(summary: string, schema: S) => ({
  config: { access: "optional" as const },
  schema: { summary, description: TICKET, tags: ["chat"], headers: meetingTicketHeadersSchema, ...schema },
});
