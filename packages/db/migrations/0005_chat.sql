CREATE TYPE "public"."chat_attachment_status" AS ENUM('uploading', 'ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."chat_message_kind" AS ENUM('text', 'gif', 'sticker', 'poll', 'system');--> statement-breakpoint
CREATE TYPE "public"."chat_mode" AS ENUM('on', 'in_meeting', 'off');--> statement-breakpoint
CREATE TABLE "chat_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"message_id" uuid,
	"uploader_attendance_id" uuid,
	"file_name" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"preview_key" text,
	"width" integer,
	"height" integer,
	"status" "chat_attachment_status" DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "chat_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_events_seq" UNIQUE("meeting_id","seq")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"call_id" uuid,
	"sender_attendance_id" uuid,
	"sender_user_id" uuid,
	"sender_name" text NOT NULL,
	"sender_group" "participant_group" NOT NULL,
	"kind" "chat_message_kind" NOT NULL,
	"body" jsonb,
	"plain_text" text,
	"gif" jsonb,
	"sticker" text,
	"system" jsonb,
	"reply_to_id" uuid,
	"client_id" uuid NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_attendance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_sent_once" UNIQUE("sender_attendance_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "chat_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"pinned_by_attendance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_pins_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "chat_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_poll_options_position" UNIQUE("poll_id","position")
);
--> statement-breakpoint
CREATE TABLE "chat_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"voter_key" text NOT NULL,
	"attendance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_poll_votes_once" UNIQUE("poll_id","option_id","voter_key")
);
--> statement-breakpoint
CREATE TABLE "chat_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"question" text NOT NULL,
	"multiple" boolean NOT NULL,
	"anonymous" boolean NOT NULL,
	"creator_attendance_id" uuid,
	"closed_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_polls_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "chat_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"attendance_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"reactor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_reactions_once" UNIQUE("message_id","attendance_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "chat_mode_at_end" "chat_mode";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "chat_mode" "chat_mode" DEFAULT 'on' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "allow_gifs" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_uploader_attendance_id_call_attendances_id_fk" FOREIGN KEY ("uploader_attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_attendance_id_call_attendances_id_fk" FOREIGN KEY ("sender_attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_chat_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deleted_by_attendance_id_call_attendances_id_fk" FOREIGN KEY ("deleted_by_attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_pinned_by_attendance_id_call_attendances_id_fk" FOREIGN KEY ("pinned_by_attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_poll_options" ADD CONSTRAINT "chat_poll_options_poll_id_chat_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."chat_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_poll_votes" ADD CONSTRAINT "chat_poll_votes_poll_id_chat_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."chat_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_poll_votes" ADD CONSTRAINT "chat_poll_votes_option_id_chat_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."chat_poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_poll_votes" ADD CONSTRAINT "chat_poll_votes_attendance_id_call_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_creator_attendance_id_call_attendances_id_fk" FOREIGN KEY ("creator_attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_attendance_id_call_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."call_attendances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_attachments_meeting_id_idx" ON "chat_attachments" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "chat_attachments_message_id_idx" ON "chat_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_attachments_status_created_idx" ON "chat_attachments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "chat_attachments_workspace_id_idx" ON "chat_attachments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_events_created_at_idx" ON "chat_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_events_workspace_id_idx" ON "chat_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_messages_meeting_order_idx" ON "chat_messages" USING btree ("meeting_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_messages_sender_user_id_idx" ON "chat_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_reply_to_id_idx" ON "chat_messages" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "chat_messages_workspace_id_idx" ON "chat_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_pins_meeting_id_idx" ON "chat_pins" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "chat_pins_workspace_id_idx" ON "chat_pins" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_poll_votes_voter_idx" ON "chat_poll_votes" USING btree ("poll_id","voter_key");--> statement-breakpoint
CREATE INDEX "chat_poll_votes_attendance_id_idx" ON "chat_poll_votes" USING btree ("attendance_id");--> statement-breakpoint
CREATE INDEX "chat_polls_meeting_id_idx" ON "chat_polls" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "chat_polls_workspace_id_idx" ON "chat_polls" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_reactions_attendance_id_idx" ON "chat_reactions" USING btree ("attendance_id");--> statement-breakpoint
CREATE INDEX "chat_reactions_workspace_id_idx" ON "chat_reactions" USING btree ("workspace_id");--> statement-breakpoint
-- At most 3 pinned messages per meeting (AC-F03-19). The meeting row is locked first, so two pins
-- made at the same moment can't both slip past the count.
CREATE FUNCTION "chat_pins_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "meetings" WHERE "id" = NEW."meeting_id" FOR UPDATE;
  IF (SELECT count(*) FROM "chat_pins" WHERE "meeting_id" = NEW."meeting_id") >= 3 THEN
    RAISE EXCEPTION 'a meeting has at most 3 pinned messages' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "chat_pins_limit" BEFORE INSERT ON "chat_pins"
  FOR EACH ROW EXECUTE FUNCTION "chat_pins_limit"();
