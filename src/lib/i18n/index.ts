import en from './en.json';

type NestedStrings = { [key: string]: string | NestedStrings };

/**
 * Simple i18n helper. V1 is English only,
 * but all strings go through this so adding locales is trivial later.
 */
const strings: NestedStrings = en;

/**
 * Get a translated string by dot-notation key.
 * Example: t('event.create.title') → 'Create Event'
 *
 * Supports simple interpolation: t('results.ofAvailable', { count: 3, total: 5 })
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    let value: string | NestedStrings = strings;

    for (const part of parts) {
        if (typeof value === 'string' || value === undefined) return key;
        value = value[part];
    }

    if (typeof value !== 'string') return key;

    if (params) {
        return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
    }

    return value;
}
