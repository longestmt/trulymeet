/**
 * SSE (Server-Sent Events) connection manager.
 * Tracks active clients per event and broadcasts updates.
 */

type SSEClient = {
    controller: ReadableStreamDefaultController;
    eventSlug: string;
};

const clients = new Map<string, Set<SSEClient>>();

/**
 * Register a new SSE client for an event.
 */
export function addClient(eventSlug: string, controller: ReadableStreamDefaultController): SSEClient {
    const client: SSEClient = { controller, eventSlug };

    if (!clients.has(eventSlug)) {
        clients.set(eventSlug, new Set());
    }
    clients.get(eventSlug)!.add(client);

    return client;
}

/**
 * Remove a client when they disconnect.
 */
export function removeClient(client: SSEClient): void {
    const eventClients = clients.get(client.eventSlug);
    if (eventClients) {
        eventClients.delete(client);
        if (eventClients.size === 0) {
            clients.delete(client.eventSlug);
        }
    }
}

/**
 * Broadcast an event to all clients watching a given event slug.
 */
export function broadcast(
    eventSlug: string,
    eventType: string,
    data: unknown
): void {
    const eventClients = clients.get(eventSlug);
    if (!eventClients) return;

    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    for (const client of eventClients) {
        try {
            client.controller.enqueue(encoded);
        } catch {
            // Client disconnected, remove them
            removeClient(client);
        }
    }
}

/**
 * Get the number of active connections for an event.
 */
export function getClientCount(eventSlug: string): number {
    return clients.get(eventSlug)?.size ?? 0;
}
