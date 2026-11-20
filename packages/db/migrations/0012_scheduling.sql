CREATE TYPE "public"."invite_answer" AS ENUM('none', 'accepted', 'tentative', 'declined');--> statement-breakpoint
CREATE TYPE "public"."invite_email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reminder_kind" AS ENUM('before', 'start');--> statement-breakpoint
CREATE TABLE "meeting_invitee_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"original_start" timestamp with time zone NOT NULL,
	"answer" "invite_answer" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_invitee_answers_once" UNIQUE("invitee_id","original_start")
);
--> statement-breakpoint
CREATE TABLE "meeting_invitees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"email_enc" text,
	"email_lookup" text,
	"key_version" integer,
	"answer" "invite_answer" DEFAULT 'none' NOT NULL,
	"answered_at" timestamp with time zone,
	"email_status" "invite_email_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_invitees_member_once" UNIQUE("meeting_id","user_id"),
	CONSTRAINT "meeting_invitees_email_once" UNIQUE("meeting_id","email_lookup")
);
--> statement-breakpoint
CREATE TABLE "meeting_occurrence_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"original_start" timestamp with time zone NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"title" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_occurrence_changes_once" UNIQUE("meeting_id","original_start")
);
--> statement-breakpoint
CREATE TABLE "meeting_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"rrule" text,
	"repeat_until" timestamp with time zone,
	"description" text DEFAULT '' NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_schedules_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE "reminder_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"original_start" timestamp with time zone NOT NULL,
	"kind" "reminder_kind" NOT NULL,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_dismissals_once" UNIQUE("user_id","meeting_id","original_start","kind")
);
--> statement-breakpoint
ALTER TABLE "meeting_invitee_answers" ADD CONSTRAINT "meeting_invitee_answers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_invitee_answers" ADD CONSTRAINT "meeting_invitee_answers_invitee_id_meeting_invitees_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."meeting_invitees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_occurrence_changes" ADD CONSTRAINT "meeting_occurrence_changes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_occurrence_changes" ADD CONSTRAINT "meeting_occurrence_changes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_schedules" ADD CONSTRAINT "meeting_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_schedules" ADD CONSTRAINT "meeting_schedules_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_dismissals" ADD CONSTRAINT "reminder_dismissals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_dismissals" ADD CONSTRAINT "reminder_dismissals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_dismissals" ADD CONSTRAINT "reminder_dismissals_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_invitee_answers_workspace_id_idx" ON "meeting_invitee_answers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meeting_invitees_workspace_id_idx" ON "meeting_invitees" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meeting_invitees_user_id_idx" ON "meeting_invitees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meeting_occurrence_changes_workspace_id_idx" ON "meeting_occurrence_changes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meeting_schedules_workspace_id_idx" ON "meeting_schedules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "reminder_dismissals_workspace_id_idx" ON "reminder_dismissals" USING btree ("workspace_id");--> statement-breakpoint
-- Each invitee is a member or an external email, never both or neither (F13 design.md "Data stored").
ALTER TABLE "meeting_invitees" ADD CONSTRAINT "meeting_invitees_one_kind"
  CHECK (("user_id" IS NULL) <> ("email_lookup" IS NULL));--> statement-breakpoint
-- At most 250 invitees per meeting (AC-F13-08); the meeting row is locked so two adds can't pass it.
CREATE FUNCTION "meeting_invitees_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "meetings" WHERE "id" = NEW."meeting_id" FOR UPDATE;
  IF (SELECT count(*) FROM "meeting_invitees" WHERE "meeting_id" = NEW."meeting_id") >= 250 THEN
    RAISE EXCEPTION 'a meeting has at most 250 invitees' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "meeting_invitees_limit" BEFORE INSERT ON "meeting_invitees"
  FOR EACH ROW EXECUTE FUNCTION "meeting_invitees_limit"();
