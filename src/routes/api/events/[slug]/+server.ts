import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
    const { slug } = params;

    const event = await db.query.events.findFirst({
        where: eq(events.slug, slug)
    });

    if (!event) {
        return json({ error: 'not_found', message: 'Event not found.' }, { status: 404 });
    }

    // Synthesize timeBlocks for legacy events
    const timeBlocks = event.timeBlocks ?? [{
        startTime: event.startTime,
        endTime: event.endTime,
        days: event.candidateDates as string[]
    }];

    // Don't expose sensitive fields
    return json({
        slug: event.slug,
        title: event.title,
        description: event.description,
        timezone: event.timezone,
        timeGranularityMinutes: event.timeGranularityMinutes,
        candidateDates: event.candidateDates,
        startTime: event.startTime,
        endTime: event.endTime,
        timeBlocks,
        allowMaybe: event.allowMaybe,
        locked: event.locked,
        hasPassword: !!event.passwordHash,
        createdAt: event.createdAt.toISOString()
    });
};
