import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { participants, availability, events } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rate-limit';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

/**
 * POST /api/events/:slug/participants
 * Add a new participant with their availability
 */
export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
    const { slug } = params;

    // Rate limiting
    const clientIp = getClientAddress();
    const limit = parseInt(env.RATE_LIMIT_SUBMISSIONS_PER_HOUR || '60', 10);
    if (!checkRateLimit(`submit:${slug}:${clientIp}`, limit)) {
        return json(
            { error: 'rate_limited', message: 'Too many submissions. Please try again later.' },
            { status: 429 }
        );
    }

    // Find the event
    const event = await db.query.events.findFirst({
        where: eq(events.slug, slug)
    });

    if (!event) {
        return json({ error: 'not_found', message: 'Event not found.' }, { status: 404 });
    }

    if (event.locked) {
        return json({ error: 'locked', message: 'This event is locked.' }, { status: 403 });
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const { displayName, password, slots } = body as {
        displayName?: string;
        password?: string;
        slots?: { slotStart: string; status: 'available' | 'maybe' }[];
    };

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        return json({ error: 'validation', message: 'Display name is required.' }, { status: 400 });
    }

    if (displayName.length > 50) {
        return json({ error: 'validation', message: 'Display name must be 50 characters or less.' }, { status: 400 });
    }

    // Hash participant password if provided
    let passwordHash: string | null = null;
    if (password && typeof password === 'string' && password.length > 0) {
        passwordHash = await hashPassword(password);
    }

    try {
        // Create participant
        const [participant] = await db.insert(participants).values({
            eventId: event.id,
            displayName: displayName.trim(),
            passwordHash
        }).returning();

        // Insert availability slots
        if (slots && Array.isArray(slots) && slots.length > 0) {
            const availabilityRows = slots.map((slot) => ({
                participantId: participant.id,
                eventId: event.id,
                slotStart: new Date(slot.slotStart),
                status: slot.status as 'available' | 'maybe'
            }));
            await db.insert(availability).values(availabilityRows);
        }

        // Update last activity
        await db.update(events)
            .set({ lastActivityAt: new Date() })
            .where(eq(events.id, event.id));

        return json({
            id: participant.id,
            displayName: participant.displayName
        }, { status: 201 });
    } catch (err) {
        console.error('Failed to create participant:', err);
        return json(
            { error: 'server_error', message: 'Failed to save response.' },
            { status: 500 }
        );
    }
};

/**
 * GET /api/events/:slug/participants
 * List all participants and their availability for an event
 */
export const GET: RequestHandler = async ({ params }) => {
    const { slug } = params;

    const event = await db.query.events.findFirst({
        where: eq(events.slug, slug)
    });

    if (!event) {
        return json({ error: 'not_found', message: 'Event not found.' }, { status: 404 });
    }

    const eventParticipants = await db.query.participants.findMany({
        where: eq(participants.eventId, event.id)
    });

    const eventAvailability = await db.query.availability.findMany({
        where: eq(availability.eventId, event.id)
    });

    // Group availability by participant
    const participantData = eventParticipants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        createdAt: p.createdAt.toISOString(),
        slots: eventAvailability
            .filter((a) => a.participantId === p.id)
            .map((a) => ({
                slotStart: a.slotStart.toISOString(),
                status: a.status
            }))
    }));

    return json({ participants: participantData });
};
