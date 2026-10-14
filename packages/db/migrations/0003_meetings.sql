CREATE TYPE "public"."attendance_status" AS ENUM('waiting', 'admitted', 'in_call', 'left', 'denied', 'removed', 'timed_out', 'turned_away');--> statement-breakpoint
CREATE TYPE "public"."call_end_reason" AS ENUM('last_left', 'ended', 'time_limit');--> statement-breakpoint
CREATE TYPE "public"."left_reason" AS ENUM('leave', 'dropped', 'removed', 'ended');--> statement-breakpoint
CREATE TYPE "public"."meeting_audience" AS ENUM('everyone', 'workspace', 'organizers');--> statement-breakpoint
CREATE TYPE "public"."meeting_kind" AS ENUM('meet_now', 'link');--> statement-breakpoint
CREATE TYPE "public"."participant_group" AS ENUM('member', 'external', 'guest');--> statement-breakpoint
CREATE TYPE "public"."role_override" AS ENUM('presenter', 'attendee');--> statement-breakpoint
CREATE TABLE "call_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"call_id" uuid,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"guest_device_hash" text,
	"participant_group" "participant_group" NOT NULL,
	"role_override" "role_override",
	"status" "attendance_status" DEFAULT 'waiting' NOT NULL,
	"ticket_hash" text NOT NULL,
	"lobby_entered_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"admitted_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"left_reason" "left_reason",
	"acted_by" uuid,
	"last_event_at" timestamp with time zone,
	"rejoined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_attendances_ticket_hash_unique" UNIQUE("ticket_hash")
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" "call_end_reason",
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "livekit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "livekit_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_co_organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_co_organizers_once" UNIQUE("meeting_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"kind" "meeting_kind" NOT NULL,
	"title" text NOT NULL,
	"meeting_number" text NOT NULL,
	"link_lookup" text NOT NULL,
	"link_secret_enc" text NOT NULL,
	"passcode_check" text NOT NULL,
	"passcode_enc" text NOT NULL,
	"key_version" integer NOT NULL,
	"lobby_bypass" "meeting_audience" DEFAULT 'workspace' NOT NULL,
	"who_can_present" "meeting_audience" DEFAULT 'everyone' NOT NULL,
	"allow_attendee_mic" boolean DEFAULT true NOT NULL,
	"allow_attendee_camera" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_meeting_number_unique" UNIQUE("meeting_number"),
	CONSTRAINT "meetings_link_lookup_unique" UNIQUE("link_lookup")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "allow_guests" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_acted_by_call_attendances_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."call_attendances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_co_organizers" ADD CONSTRAINT "meeting_co_organizers_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_co_organizers" ADD CONSTRAINT "meeting_co_organizers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_attendances_meeting_status_idx" ON "call_attendances" USING btree ("meeting_id","status");--> statement-breakpoint
CREATE INDEX "call_attendances_call_status_idx" ON "call_attendances" USING btree ("call_id","status");--> statement-breakpoint
CREATE INDEX "call_attendances_user_id_idx" ON "call_attendances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "call_attendances_workspace_id_idx" ON "call_attendances" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_one_running_per_meeting" ON "calls" USING btree ("meeting_id") WHERE "calls"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "calls_workspace_id_idx" ON "calls" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meeting_co_organizers_user_id_idx" ON "meeting_co_organizers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meetings_workspace_id_idx" ON "meetings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meetings_organizer_id_idx" ON "meetings" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "meetings_expires_at_idx" ON "meetings" USING btree ("expires_at");--> statement-breakpoint
-- At most 10 co-organizers per meeting (AC-F02-36). The meeting row is locked first, so two names
-- added at the same moment can't both slip past the count.
CREATE FUNCTION "meeting_co_organizers_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "meetings" WHERE "id" = NEW."meeting_id" FOR UPDATE;
  IF (SELECT count(*) FROM "meeting_co_organizers" WHERE "meeting_id" = NEW."meeting_id") >= 10 THEN
    RAISE EXCEPTION 'a meeting has at most 10 co-organizers' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "meeting_co_organizers_limit" BEFORE INSERT ON "meeting_co_organizers"
  FOR EACH ROW EXECUTE FUNCTION "meeting_co_organizers_limit"();
