# SongFind

A self-hosted web app to manage your personal music collection. Import song lists, see what you already own (on your NAS or available via Azuracast), automatically acquire missing tracks through Lidarr/Prowlarr, and export any list as a zip of audio files.

SongFind orchestrates tools you already run — it does not reimplement search or download infrastructure.

## Features

- **Import lists** — paste `Artist - Title` lines or upload a CSV
- **Match against your library** — fuzzy-matches your lists against NAS files and Azuracast tracks
- **Acquire missing tracks** — triggers Lidarr/Prowlarr; falls back to YouTube with your approval
- **Export to zip** — downloads all owned tracks from a list as `Artist - Title.ext` files
- **Library browser** — searchable view of NAS files and Azuracast tracks with direct download
- **Spotify import** — import liked songs or playlists as a list
- **Duplicate detection** — find and merge duplicate artists/tracks
- **Configurable match threshold** — tune how strict the fuzzy matching is

## Prerequisites

- Docker and Docker Compose
- A NAS share mounted on the host (SMB/NFS)
- Existing Lidarr and/or Prowlarr instance (optional — for acquisition)
- Existing Azuracast instance (optional — for on-air matching and download)
- A Spotify app registered at [developer.spotify.com](https://developer.spotify.com) (optional — for Spotify import)

## Getting Started

**1. Clone the repo**

```bash
git clone https://github.com/your-username/songfind.git
cd songfind
```

**2. Set your NAS mount path**

Create a `.env` file at the root:

```env
NAS_MOUNT_PATH=/path/to/your/nas/music
```

If you skip this, a local `./data/nas-music` folder is used instead.

**3. Start the stack**

```bash
docker compose up --build -d
```

The app will be available at `http://localhost:3000`.

**4. Configure connections**

Open Settings and fill in your Lidarr, Prowlarr, Azuracast, and NAS mount path. All credentials are stored in the database — nothing is committed to the repo.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS (Node/TypeScript) |
| Frontend | React 19 + Vite |
| Database | PostgreSQL 16 (Prisma ORM) |
| Queue | Redis + BullMQ |
| Audio tools | yt-dlp, ffmpeg |

## Updating

From the LXC or host where the repo is checked out:

```bash
git pull
docker compose up --build -d
```

Migrations run automatically on startup.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NAS_MOUNT_PATH` | `./data/nas-music` | Path to your music library, mounted into the container |
| `DATABASE_URL` | set in compose | PostgreSQL connection string |
| `REDIS_URL` | set in compose | Redis connection string |
| `PORT` | `3000` | Port the app listens on |

## License

MIT
