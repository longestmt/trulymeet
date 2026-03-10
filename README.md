# TrulyMeet

TrulyMeet is a free, open-source group scheduling tool. It is built to be fast, private, and simple to use without requiring user accounts or tracking.

![TrulyMeet Homepage](./static/docs/homepage.png)

## Features

- **No Accounts Required**: Jump right in, pick your candidate dates, and share a link.
- **Privacy First**: We don't track you. Event details are ephemeral.
- **Modern Interface**: A clean, responsive design that works beautifully perfectly on desktop and mobile.
- **Dark, Light, and AMOLED Themes**: Beautiful built-in themes out-of-the-box (using the [Compline](https://github.com/jblais493/compline) palette).
- **Timezone Aware**: Automatically detects timezones to prevent scheduling confusion across regions.

### Finding a Time

Participants get a simple, continuous grid on desktop and a smooth day-by-day swipe interface on mobile to select their availability.

![TrulyMeet Availability Grid](./static/docs/availability.png)

Features include:
- Auto-save with debouncing to never lose progress.
- Multi-day copy and "Select all" / "Clear" features for quick filling.
- Real-time updates via Server-Sent Events (SSE) see when others join the event and add their availability instantly.
- "Maybe" support for flexible scheduling.
- A "Group Results" tab that shows a heat map and automatically calculates the best times for everyone.

## Tech Stack

TrulyMeet is built using a modern open-source stack:
- **Framework**: [SvelteKit](https://kit.svelte.dev/) (with Svelte 5 runes)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: Vanilla CSS with custom properties (CSS variables) for lightweight, dependency-free theming.

## Development Setup

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/longestmt/trulymeet.git
cd trulymeet
npm install
```

2. Set up a local PostgreSQL database. You can use Docker:
```bash
docker run -d --name trulymeet-db -e POSTGRES_USER=trulymeet -e POSTGRES_PASSWORD=trulymeet -e POSTGRES_DB=trulymeet -p 5432:5432 postgres:16-alpine
```

3. Copy the example environment file and update it with your database URL:
```bash
cp .env.example .env
# Edit .env and set DATABASE_URL=postgres://trulymeet:trulymeet@localhost:5432/trulymeet
```

4. Push the database schema:
```bash
npx drizzle-kit push
```

5. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:5199` in your browser.

## Deployment

TrulyMeet includes a `docker-compose.yml` for easy self-hosting. It uses the pre-built Docker image hosted on the GitHub Container Registry.

To deploy using Docker Compose:

1. Download the configuration files to your server:
```bash
curl -O https://raw.githubusercontent.com/longestmt/trulymeet/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/longestmt/trulymeet/main/.env.example
```

2. Edit the `.env` file and update your variables (especially `BASE_URL`, and `DATABASE_URL` if you change the database credentials).

3. Start the containers in the background. This will automatically pull the `ghcr.io/longestmt/trulymeet` image and configure the database schema:
```bash
docker compose up -d
```

The app will now be exposed locally on port `3988`. You can configure your own reverse proxy (like Nginx, Caddy, or Traefik) to route traffic to it and handle HTTPS.

## Support

If you find TrulyMeet useful, consider buying me a coffee!

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/longestmt)

## License

This project is licensed under the AGPL-3.0 License.
