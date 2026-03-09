# TrulyMeet — Product Requirements Document

**Version:** 1.0
**Date:** March 7, 2026
**Status:** Draft

---

## 1. Overview

TrulyMeet is a free, open-source group scheduling tool that helps multiple people find a common meeting time. It is built with a mobile-first UI, no accounts, no tracking, and no ads.

The core interaction is simple — create an event with candidate dates/times, share a link, participants mark their availability on a grid, and the overlap is visualized — and the experience is designed from the ground up to work beautifully on phones, feel fast and modern, and respect user privacy.

TrulyMeet is licensed under a copyleft free software license (AGPL-3.0) and is designed to be both self-hostable and deployable as a hosted service.

---

## 2. Problem Statement

Legacy scheduling tools solve a real problem well — finding group availability without accounts or friction — but often have significant UX shortcomings:

- **The mobile experience is broken.** The desktop grid is served as-is to mobile browsers. Dragging to select time slots on a small touch screen is imprecise and frustrating. There is no responsive layout.
- **The visual design is dated.** The interface looks like it was built in the early 2000s (because it was). There is no dark mode, poor contrast, and no visual hierarchy.
- **Interaction gaps.** No undo, no way to copy one day's availability to another, no keyboard navigation, and no accessibility support.
- **No self-hosting option.** Users who care about data sovereignty have no way to run their own instance.

TrulyMeet keeps what works (no signup, shareable link, grid-based availability) and fixes everything else.

---

## 3. Target Users

- **Primary:** Students coordinating group projects, study sessions, and social plans.
- **Secondary:** Informal teams, clubs, community organizers, and friend groups planning events.
- **Tertiary:** Anyone who needs lightweight group scheduling without the overhead of Calendly, Doodle, or similar tools.

All users share a common trait: they want the fastest possible path from "we need to find a time" to "here's when everyone can meet." They do not want to create accounts, install apps, or navigate complex UIs.

---

## 4. Design Principles

1. **Mobile-first, desktop-excellent.** Every interaction is designed for a phone screen first, then enhanced for larger screens. The grid must be usable with one thumb.
2. **Zero friction.** No accounts, no signup, no email required. A participant should go from receiving a link to submitting their availability in under 30 seconds.
3. **Clarity over density.** Prefer whitespace and legibility to cramming information. The results should be scannable at a glance.
4. **Respect the user.** No ads, no tracking, no analytics beyond what the operator opts into. The software is free (as in freedom) and free (as in beer).
5. **Accessible by default.** WCAG 2.1 AA compliance. Full keyboard navigation. Screen reader support. High contrast mode.

---

## 5. Feature Specifications

### 5.1 Event Creation

**Description:** The organizer creates a new scheduling event by selecting candidate dates and a time window.

**Requirements:**

- The organizer provides an **event title** (required, max 200 characters) and an optional **description** (max 2000 characters).
- The organizer selects **candidate dates** from an interactive calendar. Multiple individual dates or contiguous date ranges can be selected. The calendar defaults to the current month with forward/backward navigation.
- The organizer sets a **time window** (e.g., 9:00 AM – 5:00 PM) that applies to all selected dates. Defaults to 9:00 AM – 5:00 PM.
- The organizer selects a **time granularity**: 15 minutes (default), 30 minutes, or 1 hour.
- The organizer's **timezone** is auto-detected from the browser but can be manually overridden from a searchable dropdown.
- An optional **event password** can be set. If set, participants must enter it before viewing or submitting availability.
- On submission, the system generates a **unique event URL** (e.g., `trulymeet.example.com/e/abc123`) and an **admin URL** (e.g., `trulymeet.example.com/e/abc123?admin=xyz789`). The admin URL allows the organizer to edit or delete the event later.
- The organizer is prompted to **bookmark or copy both URLs**. A warning is displayed that these links are the only way to access the event.
- Events expire and are deleted after **30 days of inactivity** (no new availability submissions). The retention period is configurable by the server operator.

**Mobile considerations:**
- The date picker must be a vertically scrollable calendar, not a tiny grid. Dates are tapped to toggle, not dragged.
- The time window picker uses two native-feeling time selectors (scroll wheels or dropdowns), not a custom widget that fights the OS.

---

### 5.2 Availability Input

**Description:** Participants open the event link, enter a display name, and mark which time slots they're available.

**Requirements:**

- The participant enters a **display name** (required, max 50 characters). Names do not need to be unique. An optional **password per participant** can be set so they can edit their response later.
- The participant's timezone is **auto-detected** and displayed prominently, with the option to change it. All times are shown in the participant's local timezone.
- The availability grid shows **dates as columns** (desktop) or **one date at a time** (mobile), with time slots as rows.
- On **desktop**, availability is toggled by clicking individual cells or click-and-dragging across a range of cells. A toggle mode indicator shows whether dragging will mark cells as "available" or "unavailable."
- On **mobile**, the interaction model changes entirely:
  - Each day is shown as a **vertical list of time slots** (not a grid).
  - Time slots are toggled by **tapping** individual slots.
  - A **range selection mode** is available: tap a start time, then tap an end time, and all slots in between are toggled.
  - **Swipe left/right** to navigate between days.
  - A **"Copy to other days"** action lets the participant apply the current day's availability to other days. Tapping it opens a bottom sheet listing all other candidate days with checkboxes and a "Select all" toggle. Confirming overwrites the selected days' availability with the current day's pattern.
- Availability is **saved automatically** on every interaction. A subtle "Saved" indicator confirms this. There is no submit button.
- An **undo/redo** mechanism (last 20 actions) is available via on-screen buttons and keyboard shortcuts (Ctrl+Z / Ctrl+Y on desktop). An "action" is defined as a single user gesture: toggling one cell, a drag-select of multiple cells, a range selection, a "copy to days" operation, or a "clear/select all" operation. Each action is undone/redone atomically.
- A **"Clear day"** and **"Select all day"** action is available for each day.
- An optional **"maybe" state** can be enabled per-event by the organizer. If enabled, cells have three states: unavailable (default), available, and maybe. Tapping cycles through states: unavailable → available → maybe → unavailable. Visual encoding: available = solid green fill, maybe = amber fill with diagonal stripe pattern (45° hatching), unavailable = no fill (light grey in dark mode). The stripe pattern ensures distinguishability in high-contrast mode and for colorblind users.

**Accessibility:**
- Full keyboard navigation: arrow keys to move between cells, Space/Enter to toggle, Tab to move between days.
- ARIA labels on every cell (e.g., "Tuesday March 10, 2:00 PM to 2:15 PM, currently unavailable").
- High-contrast mode that uses patterns in addition to color to distinguish states.

---

### 5.3 Results View

**Description:** A real-time visualization of group availability, shown to all participants (and the organizer).

**Requirements:**

- The results view is displayed **alongside** the input grid on desktop (split view) and **as a separate tab/view** on mobile.
- The grid uses a **heatmap** to show overlap. The color scale goes from "no one available" (empty/white) to "everyone available" (saturated color). The exact palette adapts to light/dark mode and high-contrast mode.
- **Hovering** (desktop) or **tapping** (mobile) a cell shows a **tooltip/popover** listing which participants are available, which are "maybe," and which are unavailable at that time.
- A **"Best times" summary** is displayed above the grid, listing the top 3–5 time slots with the most overlap, formatted as human-readable strings (e.g., "Tuesday Mar 10, 2:00–3:30 PM — 8 of 10 available").
- A **participant list** is shown with a count of how many time slots each person marked as available. Clicking/tapping a participant's name highlights only their availability on the grid.
- The organizer (via the admin URL) can **lock the event** to prevent further submissions, and can **delete individual responses** (e.g., spam or duplicates).
- Results update in **real time** via WebSocket or Server-Sent Events. When a new participant submits availability, all open browsers update without refreshing.

**Mobile considerations:**
- The heatmap must use large-enough cells to be tappable. On very small screens, horizontal scrolling is acceptable for many-day events, but one-day-at-a-time view is the default.
- The "best times" summary is shown first, before the grid, so mobile users get the answer immediately without scrolling.

---

### 5.4 Sharing and Access

**Requirements:**

- The primary sharing mechanism is a **short, copyable URL**. A "Copy link" button is prominently displayed.
- A **QR code** is generated for the event URL, displayed on-screen and downloadable as a PNG. Useful for in-person groups (e.g., a professor projecting it in class).
- The event page includes **Open Graph and Twitter Card meta tags** so the link previews nicely when shared in messaging apps, with the event title, date range, and participant count.
- If the organizer set a password, participants see a password prompt before the event loads. The password is validated **server-side**: the client sends the plaintext password over HTTPS to a validation endpoint (`POST /api/events/:slug/verify`), the server compares it against the stored bcrypt hash, and returns a short-lived access token (JWT or opaque token, stored in `localStorage`) that the client includes on subsequent requests. The plaintext password is never stored on the server.

---

### 5.5 Theming and Visual Design

**Requirements:**

- **Three themes** are available, selectable via a theme switcher in the UI header. The user's choice is persisted in `localStorage`.
  - **Compline (default dark):** The primary theme, based on the [Compline color palette](https://github.com/jblais493/compline). Compline is a contemplative, muted, monastic-minimalism palette inspired by Nord and Everforest but with lower saturation and a single-tone foundation. Colors act as quiet whispers rather than loud accents — everything fades into the background until needed. The implementer should pull the exact hex values from the Compline repository and map them to the application's CSS custom properties. Use the palette's dark background tones for surfaces, its muted foreground tones for text, and its restrained accent colors for interactive elements and availability states.
  - **Compline Light:** A light-mode counterpart derived from the Compline palette. Invert the surface/background relationship (light warm-neutral backgrounds, dark text) while preserving the same muted accent colors so the feel remains consistent.
  - **Vigil (AMOLED black):** A true-black theme designed for OLED/AMOLED screens. Background is `#000000`. Surfaces (cards, popovers, bottom sheets) use `#0A0A0A`–`#111111`. Borders are subtle (`#1A1A1A`–`#222222`, 1px solid). Text is high-contrast off-white (`#E8E8E8` for body, `#FFFFFF` for headings). Accent colors are kept from the Compline palette but slightly increased in luminance (+10–15%) to maintain contrast against the pure black background. The overall feel should be minimal, stark, and battery-efficient — no gradients, no shadows, no glow effects.
- The **OS color scheme preference** (`prefers-color-scheme`) selects between Compline (dark) and Compline Light on first visit. Users can manually switch to Vigil at any time.
- A **clean, modern aesthetic** with generous whitespace, rounded corners, and smooth transitions. The look and feel should be closer to Linear or Notion than to a 2005 PHP app.
- **Typography:** A system font stack for performance (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`), with clear hierarchy (event title > section headers > body text > metadata).
- **Semantic colors for availability states** are consistent across all three themes: available (green family), maybe (amber family), unavailable (neutral/grey). The exact hue and saturation are adjusted per theme to maintain WCAG AA contrast against that theme's background.
- **Animations:** Subtle and purposeful. Cell state changes animate (color fade, ~150ms). Page transitions use a simple fade or slide. No gratuitous motion. A `prefers-reduced-motion` media query disables all animations.
- **Implementation:** All theme colors are defined as CSS custom properties on `:root` (or `[data-theme="..."]` selectors), making it straightforward to add additional themes in the future. The Compline palette hex values should be sourced directly from the [Compline repository](https://github.com/jblais493/compline) at build time or during initial implementation.

---

### 5.6 Timezone Handling

**Requirements:**

- Timezones are detected from the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` API.
- All availability data is **stored as UTC** on the server.
- Each participant's view is **rendered in their local timezone**. A participant in New York and a participant in London see the same event but with times adjusted to their respective zones.
- The current timezone is displayed in the UI with a button to change it. Changing the timezone re-renders the grid immediately.
- DST transitions are handled correctly. If an event spans a DST boundary, the grid reflects the actual local times (e.g., a 1-hour slot doesn't become 2 hours or disappear).

---

## 6. Non-Functional Requirements

### 6.1 Performance

- **Time to interactive** on a cold load: < 2 seconds on a 4G connection.
- **Availability grid rendering** for an event with 50 participants and 7 days: < 500ms.
- **Real-time updates** should appear within 1 second of another participant's change.
- The application should work acceptably on low-end devices (e.g., a 3-year-old budget Android phone).

### 6.2 Privacy and Data Minimization

- **No analytics or tracking by default.** The server operator can optionally enable privacy-respecting analytics (e.g., Plausible or Umami) via configuration, but nothing is baked in.
- **No cookies** are required for basic functionality. If the participant sets a response password, a session token may be stored in `localStorage`.
- **IP addresses** are not logged by the application (though the reverse proxy may log them — that's the operator's choice).
- **Event data** is stored only on the server's database. No data is sent to third parties.
- Events and all associated data are **permanently deleted** after the configurable retention period.

### 6.3 Accessibility

- WCAG 2.1 AA compliance.
- Full keyboard navigation for all interactive elements.
- Screen reader support with descriptive ARIA labels.
- High-contrast mode using patterns (hatching, dots) in addition to color.
- Touch targets are at least 44×44 CSS pixels on mobile.
- Focus indicators are visible and clear.

### 6.4 Internationalization (i18n)

- The UI is built with i18n in mind from the start. All user-facing strings are externalized.
- **V1 ships in English only**, but the architecture supports adding translations without code changes (e.g., JSON locale files).
- Date and time formatting respects the user's locale (e.g., 24-hour vs. 12-hour clock, date order).

### 6.5 Security

- All traffic is served over HTTPS (enforced at the reverse proxy level).
- Event and admin URLs use **cryptographically random tokens** (at least 128 bits of entropy).
- Participant response passwords are hashed with bcrypt before storage.
- The server enforces **rate limiting** on event creation (e.g., 10 events per IP per hour) and availability submission (e.g., 60 submissions per event per hour) to prevent abuse.
- Input is sanitized to prevent XSS. The event title and description are rendered as plain text, never as HTML.
- CSRF protection on all state-changing operations.

---

## 7. Technical Architecture

### 7.1 Stack Recommendation

TrulyMeet prioritizes a libre, free software stack. Every dependency should be licensed under a permissive or copyleft open-source license (MIT, Apache-2.0, GPL, AGPL, MPL, etc.). No proprietary dependencies.

**Recommended stack:**

| Layer | Technology | License | Rationale |
|---|---|---|---|
| Frontend framework | SolidJS or Svelte(Kit) | MIT | Lightweight, fast, excellent reactivity model. Svelte compiles away the framework overhead which helps mobile performance. SolidJS offers fine-grained reactivity without a virtual DOM. Either is a strong choice. |
| Styling | UnoCSS or Tailwind CSS | MIT | Utility-first CSS for rapid development. UnoCSS is more aligned with the "lean" philosophy. |
| Backend / API | SvelteKit (if Svelte) or Hono | MIT | SvelteKit provides full-stack SSR + API routes in one framework. Hono is a lightweight, edge-compatible HTTP framework if using SolidJS. |
| Database | PostgreSQL | PostgreSQL License (permissive) | Battle-tested, free, excellent JSON support for flexible schema, and good timezone handling. |
| ORM / query builder | Drizzle ORM | Apache-2.0 | Type-safe, lightweight, SQL-centric. Avoids the weight of Prisma. |
| Real-time | Server-Sent Events (SSE) | N/A (web standard) | Simpler than WebSockets for the one-way "server pushes updates to clients" pattern. No additional library needed. |
| Containerization | Docker + Docker Compose | Apache-2.0 | Standard self-hosting deployment. |
| Reverse proxy | Caddy | Apache-2.0 | Automatic HTTPS, simple config, libre. Included in the Docker Compose setup. |

**Note:** The choice between SvelteKit and SolidJS + Hono is left to the implementer. Both are excellent. SvelteKit offers a more integrated experience (fewer moving parts). SolidJS offers a more React-like mental model if that's preferred.

### 7.2 Data Model

```
Event
├── id: UUID (primary key)
├── slug: string (URL-safe, 8-12 chars, unique index)
├── admin_token: string (cryptographically random, hashed)
├── title: string
├── description: string (nullable)
├── password_hash: string (nullable, bcrypt)
├── timezone: string (IANA timezone identifier, organizer's timezone for display purposes)
├── time_granularity_minutes: integer (15, 30, or 60)
├── candidate_dates: date[] (array of dates)
├── start_time: time (daily start, e.g., 09:00)
├── end_time: time (daily end, e.g., 17:00)
├── allow_maybe: boolean (default false)
├── locked: boolean (default false)
├── created_at: timestamp with timezone
├── last_activity_at: timestamp with timezone
└── expires_at: timestamp with timezone

Participant
├── id: UUID (primary key)
├── event_id: UUID (foreign key → Event)
├── display_name: string
├── password_hash: string (nullable, bcrypt)
├── created_at: timestamp with timezone
└── updated_at: timestamp with timezone

Availability
├── id: UUID (primary key)
├── participant_id: UUID (foreign key → Participant)
├── event_id: UUID (foreign key → Event, denormalized for query performance)
├── slot_start: timestamp with timezone (UTC)
├── status: enum ('available', 'maybe')
└── created_at: timestamp with timezone

Index: (event_id, slot_start) for fast heatmap queries
Index: (participant_id) for fast participant lookups
Index: (event_id, last_activity_at) for expiration cleanup
```

**Design notes:**
- Only "available" and "maybe" slots are stored. The absence of a row means "unavailable." This keeps the table sparse and queries fast.
- `slot_start` represents the beginning of a time slot. The duration is implied by the event's `time_granularity_minutes`.
- The `admin_token` is hashed (not stored in plaintext) so that a database leak doesn't grant admin access to all events.

### 7.3 API Endpoints

```
POST   /api/events                              Create a new event
GET    /api/events/:slug                        Get event details + all availability
PATCH  /api/events/:slug                        Edit event (requires admin token)
DELETE /api/events/:slug                        Delete event (requires admin token)
POST   /api/events/:slug/verify                 Validate event password, returns access token

POST   /api/events/:slug/participants           Add a new participant + their availability
GET    /api/events/:slug/participants            List participants for an event
PUT    /api/events/:slug/participants/:id        Update a participant's availability
DELETE /api/events/:slug/participants/:id        Delete a participant (admin or participant password)

GET    /api/events/:slug/stream                 SSE endpoint for real-time updates
```

**Authentication:** The admin token is passed as an `Authorization: Bearer <token>` header. For password-protected events, the access token from `/verify` is passed the same way. Participant edit passwords are sent in the request body of PUT/DELETE operations on their own responses.

**SSE stream:** The `/stream` endpoint sends the following event types: `participant_joined` (new participant added), `availability_updated` (a participant changed their slots), `participant_removed` (a participant was deleted), and `event_updated` (event metadata changed, e.g., locked). On initial connection, the server sends a `full_state` event with the complete current data so clients that reconnect mid-session don't need a separate GET.

**Error format:** All endpoints return JSON. Errors follow `{ "error": "code", "message": "Human-readable description" }` with standard HTTP status codes: 400 (validation), 401 (auth required), 403 (forbidden), 404 (not found), 429 (rate limited).

### 7.4 Deployment

**Self-hosted (Docker Compose):**

```yaml
# docker-compose.yml (illustrative)
services:
  trulymeet:
    image: trulymeet/trulymeet:latest
    environment:
      DATABASE_URL: postgres://trulymeet:password@db:5432/trulymeet
      BASE_URL: https://meet.example.com
      EVENT_RETENTION_DAYS: 30
      RATE_LIMIT_EVENTS_PER_HOUR: 10
      ACCENT_COLOR: "#6366f1"  # Customizable branding
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: trulymeet
      POSTGRES_PASSWORD: password
      POSTGRES_DB: trulymeet

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  pgdata:
  caddy_data:
```

**Environment variables** control all configuration. No config files to edit. A `.env.example` file documents all options with descriptions and defaults.

**Database migrations:** Schema migrations are managed via Drizzle Kit (`drizzle-kit push` for development, `drizzle-kit migrate` for production). The application runs pending migrations automatically on startup, so `docker compose up` on a fresh database initializes the schema without manual steps.

**Hosted service:** The same Docker image is deployed to a cloud provider (e.g., Fly.io, Railway, or a VPS) with a managed PostgreSQL database. No architectural differences — the hosted service is just a managed instance of the self-hosted version.

---

## 8. User Flows

### 8.1 Organizer Creates an Event

1. User visits the homepage.
2. User types an event title.
3. User taps dates on a calendar to select candidate days.
4. User adjusts the time window if the default (9 AM–5 PM) doesn't fit.
5. User optionally sets a password and toggles "allow maybe."
6. User taps "Create Event."
7. A confirmation screen shows the **event link** and **admin link** with prominent "Copy" buttons and a QR code.
8. User shares the event link with participants.

**Target time from landing to shareable link: under 60 seconds.**

### 8.2 Participant Submits Availability (Mobile)

1. User taps the shared link in a messaging app.
2. The event page loads showing the event title, date range, and a name input.
3. User types their display name.
4. The first candidate day is displayed as a vertical list of time slots.
5. User taps slots they're free for. Tapped slots turn green immediately.
6. For a large block, user taps "Range select," taps start time, taps end time — the entire range turns green.
7. User swipes right to the next day. A "Copy from [previous day]" button is offered.
8. A "Saved" indicator pulses gently after each change.
9. User switches to the "Results" tab to see the group heatmap and best times.

**Target time from opening link to availability submitted: under 30 seconds for a typical 3-day event.**

### 8.3 Group Views Results

1. Any visitor to the event URL sees the results view (or switches to the "Results" tab on mobile).
2. The "Best times" section at the top immediately answers "when should we meet?"
3. The heatmap grid provides detail. Tapping a cell shows who's free.
4. As more people fill in availability, the view updates in real time.

---

## 9. Mobile UX Specification (Detailed)

Because mobile is the primary design target, this section provides additional detail.

### 9.1 Layout

- The mobile layout is a **single-column, full-width** design.
- Navigation between "Your Availability" and "Group Results" uses a **tab bar** fixed at the top of the content area (below the event header).
- The event header (title, date range, participant count) is compact and **collapses on scroll** to maximize grid space.

### 9.2 Availability Grid (Mobile)

- **One day per screen.** Days are navigated by swiping horizontally or tapping day tabs at the top.
- Each time slot is a **full-width row**, approximately 48px tall, with the time label on the left and the availability state (color + icon) on the right.
- Tapping a row toggles its state. The tap target is the full width of the row.
- A **floating action button** (or bottom toolbar) provides quick actions: "Select all," "Clear," "Copy to other days," "Range select."
- The day tabs show a **mini indicator** (dot or fill) for whether any slots are selected on that day.

### 9.3 Results Grid (Mobile)

- The default view is the **"Best times" list**, not the heatmap grid. Most mobile users just want the answer.
- A "Show grid" toggle reveals the full heatmap.
- In grid mode, each day is shown one at a time (same swipe navigation as the input view).
- Tapping a cell shows a **bottom sheet** with the participant list for that time slot.

### 9.4 Touch Gestures

| Gesture | Action |
|---|---|
| Tap | Toggle a single time slot |
| Swipe left/right | Navigate between days |
| Long press | Enter range selection mode (vibration feedback) |
| Pull down | Refresh event data |

---

## 10. Out of Scope (V1)

The following features are explicitly out of scope for the initial release but may be considered for future versions:

- Calendar integrations (Google Calendar, Outlook, Apple Calendar)
- User accounts and persistent profiles
- Email/SMS notifications and reminders
- Recurring events
- Voting/polling (e.g., ranking preferred times)
- Native mobile apps (iOS/Android)
- Embeddable widgets for other websites
- API for third-party integrations
- Multi-language translations (the architecture supports it, but V1 is English-only)

---

## 11. Success Criteria

TrulyMeet is successful if:

1. A new user can create an event and share a link in under 60 seconds on mobile.
2. A participant can submit availability for a 5-day event in under 45 seconds on mobile.
3. The Lighthouse mobile performance score is 90+ on a throttled 4G connection.
4. The application is fully usable with a screen reader (VoiceOver, TalkBack).
5. The self-hosted Docker deployment works with a single `docker compose up` command.
6. The codebase is free of proprietary dependencies and is fully AGPL-3.0 licensed.

---

## 12. Open Questions

1. **Slot density on mobile:** For 15-minute granularity over a 9 AM–5 PM window, that's 32 rows per day. Is this too many to comfortably tap through on a phone? Should the default granularity be 30 minutes on mobile, with a "show 15-min slots" toggle?
2. **Event discoverability:** Should there be any way to find an event without the link (e.g., search by title)? The current design says no (privacy-first), but this is worth confirming.
3. **Response editing:** The current design lets participants set a password to edit later. Is this sufficient, or should there be a simpler mechanism (e.g., a personal edit link, similar to the admin link)?
4. **Rate limiting specifics:** The exact rate limits should be tuned based on real-world usage. The values in this document are starting points.
