import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { events, type TimeBlock } from '$lib/server/db/schema';
import { generateSlug, generateAdminToken, hashPassword } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rate-limit';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    // Rate limiting (skip in development)
    if (env.NODE_ENV === 'production') {
        const clientIp = getClientAddress();
        const limit = parseInt(env.RATE_LIMIT_EVENTS_PER_HOUR || '10', 10);
        if (!checkRateLimit(`create:${clientIp}`, limit)) {
            return json(
                { error: 'rate_limited', message: 'Too many events created. Please try again later.' },
                { status: 429 }
            );
        }
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json(
            { error: 'invalid_json', message: 'Invalid JSON body.' },
            { status: 400 }
        );
    }

    // Validate
    const { title, description, candidateDates, startTime, endTime, timeBlocks, timeGranularityMinutes, timezone, password, allowMaybe } = body as {
        title?: string;
        description?: string;
        candidateDates?: string[];
        startTime?: string;
        endTime?: string;
        timeBlocks?: TimeBlock[];
        timeGranularityMinutes?: number;
        timezone?: string;
        password?: string;
        allowMaybe?: boolean;
    };

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return json({ error: 'validation', message: 'Title is required.' }, { status: 400 });
    }

    if (title.length > 200) {
        return json({ error: 'validation', message: 'Title must be 200 characters or less.' }, { status: 400 });
    }

    if (description && typeof description === 'string' && description.length > 2000) {
        return json({ error: 'validation', message: 'Description must be 2000 characters or less.' }, { status: 400 });
    }

    if (!candidateDates || !Array.isArray(candidateDates) || candidateDates.length === 0) {
        return json({ error: 'validation', message: 'At least one date must be selected.' }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of candidateDates) {
        if (!dateRegex.test(d)) {
            return json({ error: 'validation', message: `Invalid date format: ${d}` }, { status: 400 });
        }
    }

    // Validate timeBlocks if provided, otherwise fall back to startTime/endTime
    let resolvedTimeBlocks: TimeBlock[] | undefined;
    if (timeBlocks && Array.isArray(timeBlocks) && timeBlocks.length > 0) {
        // Validate each timeblock
        const timeRegex = /^\d{2}:\d{2}$/;
        for (const block of timeBlocks) {
            if (!block.startTime || !block.endTime || !timeRegex.test(block.startTime) || !timeRegex.test(block.endTime)) {
                return json({ error: 'validation', message: 'Each time block must have valid start and end times (HH:MM).' }, { status: 400 });
            }
            if (block.startTime >= block.endTime) {
                return json({ error: 'validation', message: 'End time must be after start time in each time block.' }, { status: 400 });
            }
            if (!block.days || !Array.isArray(block.days) || block.days.length === 0) {
                return json({ error: 'validation', message: 'Each time block must have at least one day assigned.' }, { status: 400 });
            }
            for (const day of block.days) {
                if (!candidateDates!.includes(day)) {
                    return json({ error: 'validation', message: `Day ${day} in time block is not in candidate dates.` }, { status: 400 });
                }
            }
        }

        // Ensure every candidate date is in at least one block
        for (const d of candidateDates!) {
            const covered = timeBlocks.some(b => b.days.includes(d));
            if (!covered) {
                return json({ error: 'validation', message: `Date ${d} is not assigned to any time block.` }, { status: 400 });
            }
        }

        resolvedTimeBlocks = timeBlocks;
    } else {
        // Legacy: single startTime/endTime
        if (!startTime || !endTime) {
            return json({ error: 'validation', message: 'Start and end times are required.' }, { status: 400 });
        }
        if (startTime >= endTime) {
            return json({ error: 'validation', message: 'End time must be after start time.' }, { status: 400 });
        }
    }

    // Derive legacy startTime/endTime from first block for backward compat
    const effectiveStartTime = resolvedTimeBlocks ? resolvedTimeBlocks[0].startTime : startTime!;
    const effectiveEndTime = resolvedTimeBlocks ? resolvedTimeBlocks[0].endTime : endTime!;

    const validGranularities = [15, 30, 60];
    const granularity = timeGranularityMinutes ?? 15;
    if (!validGranularities.includes(granularity)) {
        return json({ error: 'validation', message: 'Granularity must be 15, 30, or 60.' }, { status: 400 });
    }

    if (!timezone || typeof timezone !== 'string') {
        return json({ error: 'validation', message: 'Timezone is required.' }, { status: 400 });
    }

    // Generate credentials
    const slug = generateSlug();
    const adminTokenPlain = generateAdminToken();
    const adminTokenHash = await hashPassword(adminTokenPlain);

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password && typeof password === 'string' && password.length > 0) {
        passwordHash = await hashPassword(password);
    }

    // Calculate expiration
    const retentionDays = parseInt(env.EVENT_RETENTION_DAYS || '30', 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    // Insert into database
    try {
        await db.insert(events).values({
            slug,
            adminToken: adminTokenHash,
            title: title.trim(),
            description: description?.trim() || null,
            candidateDates: candidateDates.sort(),
            startTime: effectiveStartTime,
            endTime: effectiveEndTime,
            timeBlocks: resolvedTimeBlocks ?? null,
            timeGranularityMinutes: granularity,
            timezone,
            passwordHash,
            allowMaybe: allowMaybe ?? false,
            expiresAt
        });
    } catch (err) {
        console.error('Failed to create event:', err);
        return json(
            { error: 'server_error', message: 'Failed to create event. Please try again.' },
            { status: 500 }
        );
    }

    return json({
        slug,
        adminToken: adminTokenPlain
    }, { status: 201 });
};
