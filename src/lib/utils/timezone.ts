/**
 * Timezone utilities.
 */

/**
 * Detect the user's timezone from the browser.
 */
export function detectTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

/**
 * Get a list of common IANA timezones for the picker.
 */
export function getTimezoneList(): { value: string; label: string }[] {
    const zones = Intl.supportedValuesOf('timeZone');
    return zones.map((tz) => ({
        value: tz,
        label: tz.replace(/_/g, ' ')
    }));
}

/**
 * Format a time for display in a given timezone.
 */
export function formatTime(
    date: Date,
    timezone: string,
    options?: Intl.DateTimeFormatOptions
): string {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        ...options,
        timeZone: timezone
    }).format(date);
}

/**
 * Format a date for display in a given timezone.
 */
export function formatDate(
    date: Date,
    timezone: string,
    options?: Intl.DateTimeFormatOptions
): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...options,
        timeZone: timezone
    }).format(date);
}

/**
 * Generate all time slot start times for a given date, between start and end times,
 * with the specified granularity.
 *
 * Returns UTC timestamps.
 */
export function generateTimeSlots(
    dateStr: string,
    startTime: string,
    endTime: string,
    granularityMinutes: number,
    timezone: string
): Date[] {
    const slots: Date[] = [];

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let mins = startMinutes; mins < endMinutes; mins += granularityMinutes) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;

        // Create a date string with the specific time in the event's timezone
        const dateTimeStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

        // Use Intl to convert from the event timezone to UTC
        const localDate = new Date(dateTimeStr);
        // Adjust for timezone offset
        const utcDate = new Date(
            localDate.toLocaleString('en-US', { timeZone: 'UTC' })
        );
        const tzDate = new Date(
            localDate.toLocaleString('en-US', { timeZone: timezone })
        );
        const offset = tzDate.getTime() - utcDate.getTime();
        const slotUtc = new Date(localDate.getTime() - offset);

        slots.push(slotUtc);
    }

    return slots;
}
