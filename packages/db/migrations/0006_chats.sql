CREATE TYPE "public"."conversation_kind" AS ENUM('direct', 'group', 'meeting');--> statement-breakpoint
CREATE TYPE "public"."conversation_member_state" AS ENUM('accepted', 'pending', 'declined', 'left', 'removed');--> statement-breakpoint
CREATE TABLE "chat_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_request_cooldowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user" uuid NOT NULL,
	"to_user" uuid NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"state" "conversation_member_state" NOT NULL,
	"external" boolean DEFAULT false NOT NULL,
	"history_from" timestamp with time zone,
	"left_seq" integer,
	"added_by" uuid,
	"joined_at" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"muted" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"last_read_seq" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"meeting_id" uuid,
	"name" text,
	"direct_key" text,
	"created_by" uuid,
	"last_message_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_attachments" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_events" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_pins" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_polls" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "read_receipts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_events" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "allow_outside_chat" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_request_cooldowns" ADD CONSTRAINT "chat_request_cooldowns_from_user_user_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_request_cooldowns" ADD CONSTRAINT "chat_request_cooldowns_to_user_user_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_blocks_unique" ON "chat_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "chat_blocks_blocked_idx" ON "chat_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_request_cooldowns_unique" ON "chat_request_cooldowns" USING btree ("from_user","to_user");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_members_unique" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "conversation_members_workspace_id_idx" ON "conversation_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_reads_unique" ON "conversation_reads" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_reads_user_idx" ON "conversation_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_reads_workspace_id_idx" ON "conversation_reads" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_meeting_unique" ON "conversations" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_direct_unique" ON "conversations" USING btree ("workspace_id","direct_key");--> statement-breakpoint
CREATE INDEX "conversations_workspace_order_idx" ON "conversations" USING btree ("workspace_id","last_message_at");--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_attachments_conversation_id_idx" ON "chat_attachments" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_order_idx" ON "chat_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_pins_conversation_id_idx" ON "chat_pins" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_polls_conversation_id_idx" ON "chat_polls" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_conversation_seq" UNIQUE("conversation_id","seq");