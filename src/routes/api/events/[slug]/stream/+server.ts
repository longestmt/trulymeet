import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { addClient, removeClient } from '$lib/server/sse';

/**
 * GET /api/events/:slug/stream
 * Server-Sent Events endpoint for real-time updates
 */
export const GET: RequestHandler = async ({ params }) => {
    const { slug } = params;

    // Verify event exists
    const event = await db.query.events.findFirst({
        where: eq(events.slug, slug)
    });

    if (!event) {
        return new Response(JSON.stringify({ error: 'not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const stream = new ReadableStream({
        start(controller) {
            const client = addClient(slug, controller);

            // Send initial connection event
            const encoder = new TextEncoder();
            controller.enqueue(
                encoder.encode(`event: connected\ndata: ${JSON.stringify({ slug })}\n\n`)
            );

            // Keep-alive ping every 30 seconds
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch {
                    clearInterval(pingInterval);
                    removeClient(client);
                }
            }, 30000);

            // Cleanup on close
            // Note: The stream close is handled by the client disconnecting
        },
        cancel() {
            // Client disconnected — cleanup happens via removeClient
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable nginx buffering
        }
    });
};
