ALTER TABLE "workspaces" ADD COLUMN "join_link_hmac" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_join_link_hmac_unique" UNIQUE("join_link_hmac");