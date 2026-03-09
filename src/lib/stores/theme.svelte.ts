/**
 * Theme store using Svelte 5 runes.
 * Persists theme choice to localStorage and respects prefers-color-scheme.
 */

const STORAGE_KEY = 'trulymeet-theme';

export type Theme = 'compline' | 'lauds' | 'vigil';

/**
 * Detect the initial theme from localStorage or OS preference.
 */
function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'compline';

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'compline' || stored === 'lauds' || stored === 'vigil') {
        return stored;
    }

    // Follow OS preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'lauds';
    }

    return 'compline';
}

/**
 * Apply theme to the document element.
 */
function applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Create the theme store.
 */
function createThemeStore() {
    let current = $state<Theme>('compline');

    return {
        get current() {
            return current;
        },
        init() {
            current = getInitialTheme();
            applyTheme(current);
        },
        set(theme: Theme) {
            current = theme;
            applyTheme(theme);
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, theme);
            }
        },
        cycle() {
            const themes: Theme[] = ['compline', 'vigil', 'lauds'];
            const idx = themes.indexOf(current);
            const next = themes[(idx + 1) % themes.length];
            this.set(next);
        }
    };
}

export const themeStore = createThemeStore();
