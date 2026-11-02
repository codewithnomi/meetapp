CREATE TYPE "public"."call_media" AS ENUM('video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."ring_state" AS ENUM('ringing', 'accepted', 'declined', 'missed', 'cancelled');--> statement-breakpoint
CREATE TABLE "call_rings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "ring_state" DEFAULT 'ringing' NOT NULL,
	"rang_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_attendances" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ringtone" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ring_volume" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "media" "call_media";--> statement-breakpoint
ALTER TABLE "call_rings" ADD CONSTRAINT "call_rings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_rings" ADD CONSTRAINT "call_rings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_rings" ADD CONSTRAINT "call_rings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_rings_call_id_idx" ON "call_rings" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_rings_user_state_idx" ON "call_rings" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "call_rings_workspace_id_idx" ON "call_rings" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_attendances_conversation_id_idx" ON "call_attendances" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_one_running_per_conversation" ON "calls" USING btree ("conversation_id") WHERE "calls"."ended_at" is null;--> statement-breakpoint
ALTER TABLE "call_attendances" ADD CONSTRAINT "call_attendances_meeting_or_conversation" CHECK (num_nonnulls("call_attendances"."meeting_id", "call_attendances"."conversation_id") = 1) NOT VALID;--> statement-breakpoint
ALTER TABLE "call_attendances" VALIDATE CONSTRAINT "call_attendances_meeting_or_conversation";--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_meeting_or_conversation" CHECK (num_nonnulls("calls"."meeting_id", "calls"."conversation_id") = 1) NOT VALID;--> statement-breakpoint
ALTER TABLE "calls" VALIDATE CONSTRAINT "calls_meeting_or_conversation";