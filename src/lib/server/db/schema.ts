import { pgTable, uuid, varchar, text, integer, boolean, timestamp, time, date, pgEnum, jsonb } from 'drizzle-orm/pg-core';

// TimeBlock type for multiple time ranges per event
export type TimeBlock = {
	startTime: string;  // "HH:MM"
	endTime: string;    // "HH:MM"
	days: string[];     // ["2026-03-20", "2026-03-22", ...]
};

// Availability status enum
export const availabilityStatusEnum = pgEnum('availability_status', ['available', 'maybe']);

// ─── Event ───────────────────────────────────────────────
export const events = pgTable('events', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: varchar('slug', { length: 12 }).notNull().unique(),
	adminToken: varchar('admin_token', { length: 128 }).notNull(), // bcrypt hash
	title: varchar('title', { length: 200 }).notNull(),
	description: text('description'),
	passwordHash: varchar('password_hash', { length: 128 }),
	timezone: varchar('timezone', { length: 64 }).notNull(),
	timeGranularityMinutes: integer('time_granularity_minutes').notNull().default(15),
	candidateDates: date('candidate_dates', { mode: 'string' }).array().notNull(),
	startTime: time('start_time').notNull().default('09:00'),
	endTime: time('end_time').notNull().default('17:00'),
	timeBlocks: jsonb('time_blocks').$type<TimeBlock[]>(),
	allowMaybe: boolean('allow_maybe').notNull().default(false),
	locked: boolean('locked').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

// ─── Participant ─────────────────────────────────────────
export const participants = pgTable('participants', {
	id: uuid('id').primaryKey().defaultRandom(),
	eventId: uuid('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade' }),
	displayName: varchar('display_name', { length: 50 }).notNull(),
	passwordHash: varchar('password_hash', { length: 128 }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─── Availability ────────────────────────────────────────
export const availability = pgTable('availability', {
	id: uuid('id').primaryKey().defaultRandom(),
	participantId: uuid('participant_id')
		.notNull()
		.references(() => participants.id, { onDelete: 'cascade' }),
	eventId: uuid('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade' }),
	slotStart: timestamp('slot_start', { withTimezone: true }).notNull(),
	status: availabilityStatusEnum('status').notNull().default('available'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Type exports
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Availability = typeof availability.$inferSelect;
export type NewAvailability = typeof availability.$inferInsert;
