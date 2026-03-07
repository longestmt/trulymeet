# TrulyMeet

TrulyMeet is a free, open-source group scheduling tool designed as a modern replacement for When2Meet. It is built to be fast, private, and simple to use without requiring user accounts or tracking.

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

TrulyMeet includes a multi-stage `Dockerfile` and a `docker-compose.yml` for easy self-hosting alongside a Caddy reverse proxy for automatic HTTPS. See the compose file for volume and networking configuration.

## License

This project is licensed under the AGPL-3.0 License.
