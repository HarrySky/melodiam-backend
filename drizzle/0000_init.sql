CREATE TABLE "history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fk_user_id" integer NOT NULL,
	"spotify_track_id" text NOT NULL,
	"spotify_track_name" text NOT NULL,
	"spotify_track_duration" integer NOT NULL,
	"spotify_track_genres" jsonb NOT NULL,
	"spotify_artist_names" jsonb NOT NULL,
	"spotify_album_name" text NOT NULL,
	"spotify_context" jsonb NOT NULL,
	"listened_for" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"spotify_user_id" text NOT NULL,
	"spotify_display_name" text,
	"spotify_access_token" text NOT NULL,
	"spotify_refresh_token" text NOT NULL,
	"spotify_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_spotify_user_id_unique" UNIQUE("spotify_user_id")
);
--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_fk_user_id_users_id_fk" FOREIGN KEY ("fk_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spotify_track_id_idx" ON "history" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE INDEX "added_at_idx" ON "history" USING btree ("added_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "spotify_user_id_idx" ON "users" USING btree ("spotify_user_id");--> statement-breakpoint
CREATE INDEX "last_login_at_idx" ON "users" USING btree ("last_login_at" DESC NULLS LAST);