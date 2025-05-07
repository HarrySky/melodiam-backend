# Melodiam Backend

Backend REST API for collecting and sharing what you are listening to on Spotify.

## Quick start

Install dependencies:
```bash
bun install
```

Copy env file:
```bash
cp .env.example .env
```

Run locally without any data persistence:
```bash
sudo docker compose up -d
npx drizzle-kit migrate

bun run start
# OR
bun run start:dev
# OR
bun run build
bun run start:prod
```

Add `http://localhost:3000/api/auth/login_redirect` URL in your app dashboard on Spotify.

Go to `http://localhost:3000/api/auth/make_me_main_user?secret=mainusersecretmainusersecretmain` for API to recognize you as main user.

Go to `http://localhost:3000/api/auth/login` to allow app to get your playback from Spotify Web API.

Listen to something and check data via following endpoints:
- `http://localhost:3000/api/spotify/user` - current user whose playback is being processed, if somebody logged in at some point
- `http://localhost:3000/api/spotify/current_song` - current song that is playing, if any
- `http://localhost:3000/api/spotify/latest_history` - last 10 songs that were playing, if any

## Why?

I wanted to create `Nest.JS` + `PostgreSQL` + `Redis` backend app with Bun, to see if Bun is stable enough. It is, great news!
