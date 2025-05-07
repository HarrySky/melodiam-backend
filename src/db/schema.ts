import {
  timestamp,
  text,
  integer,
  pgTable,
  bigserial,
  serial,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import type { MelodiamContext } from 'src/spotify/types';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    userId: text('spotify_user_id').notNull().unique(),
    displayName: text('spotify_display_name'),
    accessToken: text('spotify_access_token').notNull(),
    refreshToken: text('spotify_refresh_token').notNull(),
    expiresAt: timestamp('spotify_expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('spotify_user_id_idx').on(table.userId),
    index('last_login_at_idx').on(table.lastLoginAt.desc()),
  ],
);

export const history = pgTable(
  'history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: integer('fk_user_id')
      .references(() => users.id)
      .notNull(),
    trackId: text('spotify_track_id').notNull(),
    trackName: text('spotify_track_name').notNull(),
    trackDuration: integer('spotify_track_duration').notNull(),
    trackGenres: jsonb('spotify_track_genres').$type<string[]>().notNull(),
    artistNames: jsonb('spotify_artist_names').$type<string[]>().notNull(),
    albumName: text('spotify_album_name').notNull(),
    context: jsonb('spotify_context').$type<MelodiamContext>().notNull(),
    listenedFor: integer('listened_for').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('spotify_track_id_idx').on(table.trackId),
    index('added_at_idx').on(table.addedAt.desc()),
  ],
);
