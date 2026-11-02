ALTER TABLE "chat_reactions" ALTER COLUMN "attendance_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "uploader_user_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "deleted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "mentioned_user_ids" uuid[];--> statement-breakpoint
ALTER TABLE "chat_pins" ADD COLUMN "pinned_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_poll_votes" ADD COLUMN "voter_user_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD COLUMN "creator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_reactions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_pins" ADD CONSTRAINT "chat_pins_pinned_by_user_id_user_id_fk" FOREIGN KEY ("pinned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_poll_votes" ADD CONSTRAINT "chat_poll_votes_voter_user_id_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_polls" ADD CONSTRAINT "chat_polls_creator_user_id_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reactions" ADD CONSTRAINT "chat_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_sent_once_by_user" ON "chat_messages" USING btree ("sender_user_id","client_id") WHERE "chat_messages"."sender_attendance_id" is null;--> statement-breakpoint
CREATE INDEX "chat_poll_votes_voter_user_id_idx" ON "chat_poll_votes" USING btree ("voter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_reactions_once_by_user" ON "chat_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "chat_reactions_user_id_idx" ON "chat_reactions" USING btree ("user_id");