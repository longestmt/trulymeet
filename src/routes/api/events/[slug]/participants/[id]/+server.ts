import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { participants, availability, events } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * PUT /api/events/:slug/participants/:id
 * Update a participant's availability (full replacement)
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    const { slug, id } = params;

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

    // Find the participant
    const participant = await db.query.participants.findFirst({
        where: and(eq(participants.id, id), eq(participants.eventId, event.id))
    });

    if (!participant) {
        return json({ error: 'not_found', message: 'Participant not found.' }, { status: 404 });
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
    }

    const { slots } = body as {
        slots?: { slotStart: string; status: 'available' | 'maybe' }[];
    };

    try {
        // Delete existing availability for this participant
        await db.delete(availability).where(eq(availability.participantId, id));

        // Insert new availability
        if (slots && Array.isArray(slots) && slots.length > 0) {
            const availabilityRows = slots.map((slot) => ({
                participantId: id,
                eventId: event.id,
                slotStart: new Date(slot.slotStart),
                status: slot.status as 'available' | 'maybe'
            }));
            await db.insert(availability).values(availabilityRows);
        }

        // Update timestamps
        await db.update(participants)
            .set({ updatedAt: new Date() })
            .where(eq(participants.id, id));

        await db.update(events)
            .set({ lastActivityAt: new Date() })
            .where(eq(events.id, event.id));

        return json({ success: true });
    } catch (err) {
        console.error('Failed to update availability:', err);
        return json(
            { error: 'server_error', message: 'Failed to update availability.' },
            { status: 500 }
        );
    }
};

/**
 * DELETE /api/events/:slug/participants/:id
 * Delete a participant and their availability
 */
export const DELETE: RequestHandler = async ({ params }) => {
    const { slug, id } = params;

    const event = await db.query.events.findFirst({
        where: eq(events.slug, slug)
    });

    if (!event) {
        return json({ error: 'not_found', message: 'Event not found.' }, { status: 404 });
    }

    const participant = await db.query.participants.findFirst({
        where: and(eq(participants.id, id), eq(participants.eventId, event.id))
    });

    if (!participant) {
        return json({ error: 'not_found', message: 'Participant not found.' }, { status: 404 });
    }

    try {
        // Cascade delete handles availability
        await db.delete(participants).where(eq(participants.id, id));

        return json({ success: true });
    } catch (err) {
        console.error('Failed to delete participant:', err);
        return json(
            { error: 'server_error', message: 'Failed to delete participant.' },
            { status: 500 }
        );
    }
};
