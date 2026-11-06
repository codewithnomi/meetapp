ALTER TABLE "user" ADD COLUMN "manual_status" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "manual_status_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_mentions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_lobby" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_sound" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_preview" boolean DEFAULT true NOT NULL;