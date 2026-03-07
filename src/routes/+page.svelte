<script lang="ts">
    import Calendar from "$lib/components/Calendar.svelte";
    import TimePicker from "$lib/components/TimePicker.svelte";
    import { detectTimezone } from "$lib/utils/timezone";
    import { t } from "$lib/i18n";

    // Form state
    let title = $state("");
    let description = $state("");
    let selectedDates = $state<string[]>([]);
    let startTime = $state("09:00");
    let endTime = $state("17:00");
    let granularity = $state(15);
    let timezone = $state("");
    let password = $state("");
    let allowMaybe = $state(false);

    // UI state
    let submitting = $state(false);
    let error = $state("");

    // Detect timezone on mount
    import { onMount } from "svelte";
    onMount(() => {
        timezone = detectTimezone();
    });

    // Validation
    let isValid = $derived(
        title.trim().length > 0 &&
            selectedDates.length > 0 &&
            startTime < endTime,
    );

    async function handleSubmit() {
        if (!isValid || submitting) return;

        submitting = true;
        error = "";

        try {
            const res = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    candidateDates: selectedDates,
                    startTime,
                    endTime,
                    timeGranularityMinutes: granularity,
                    timezone,
                    password: password || null,
                    allowMaybe,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                error = data.message || "Something went wrong";
                return;
            }

            const data = await res.json();
            // Redirect to the confirmation page with admin token
            window.location.href = `/e/${data.slug}/created?admin=${data.adminToken}`;
        } catch {
            error = "Network error. Please try again.";
        } finally {
            submitting = false;
        }
    }
</script>

<svelte:head>
    <title>TrulyMeet — {t("app.tagline")}</title>
    <meta property="og:title" content="TrulyMeet" />
    <meta property="og:description" content={t("app.description")} />
</svelte:head>

<div class="container">
    <div class="hero">
        <h1>{t("app.name")}</h1>
        <p class="hero-tagline">{t("app.tagline")}</p>
    </div>

    <form
        class="create-form"
        onsubmit={(e) => {
            e.preventDefault();
            handleSubmit();
        }}
    >
        <!-- Title -->
        <div class="form-group">
            <label class="label" for="event-title"
                >{t("event.create.titleLabel")}</label
            >
            <input
                id="event-title"
                class="input"
                type="text"
                bind:value={title}
                placeholder={t("event.create.titlePlaceholder")}
                maxlength={200}
                required
            />
        </div>

        <!-- Description -->
        <div class="form-group">
            <label class="label" for="event-desc"
                >{t("event.create.descriptionLabel")}</label
            >
            <textarea
                id="event-desc"
                class="input"
                bind:value={description}
                placeholder={t("event.create.descriptionPlaceholder")}
                maxlength={2000}
                rows={3}
            ></textarea>
        </div>

        <!-- Calendar -->
        <div class="form-group">
            <span class="label">{t("event.create.datesLabel")}</span>
            <p class="form-hint">{t("event.create.datesHint")}</p>
            <div class="calendar-container card">
                <Calendar bind:selectedDates />
            </div>
        </div>

        <!-- Time window -->
        <div class="form-group">
            <span class="label">{t("event.create.timeWindowLabel")}</span>
            <div class="time-row">
                <TimePicker
                    bind:value={startTime}
                    label={t("event.create.startTimeLabel")}
                    id="start-time"
                />
                <span class="time-separator">to</span>
                <TimePicker
                    bind:value={endTime}
                    label={t("event.create.endTimeLabel")}
                    id="end-time"
                />
            </div>
        </div>

        <!-- Granularity -->
        <div class="form-group">
            <label class="label" for="granularity"
                >{t("event.create.granularityLabel")}</label
            >
            <div
                class="granularity-pills"
                role="radiogroup"
                aria-label="Time slot granularity"
            >
                {#each [{ value: 15, label: t("event.create.granularity15") }, { value: 30, label: t("event.create.granularity30") }, { value: 60, label: t("event.create.granularity60") }] as opt}
                    <button
                        type="button"
                        class="pill"
                        class:active={granularity === opt.value}
                        role="radio"
                        aria-checked={granularity === opt.value}
                        onclick={() => (granularity = opt.value)}
                    >
                        {opt.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Timezone -->
        <div class="form-group">
            <label class="label" for="timezone"
                >{t("event.create.timezoneLabel")}</label
            >
            <input
                id="timezone"
                class="input"
                type="text"
                bind:value={timezone}
                readonly
            />
        </div>

        <!-- Password (optional) -->
        <div class="form-group">
            <label class="label" for="event-password"
                >{t("event.create.passwordLabel")}</label
            >
            <input
                id="event-password"
                class="input"
                type="password"
                bind:value={password}
                placeholder={t("event.create.passwordPlaceholder")}
            />
        </div>

        <!-- Allow maybe -->
        <div class="form-group toggle-group">
            <label class="toggle-label" for="allow-maybe">
                <input
                    id="allow-maybe"
                    type="checkbox"
                    bind:checked={allowMaybe}
                    class="toggle-input"
                />
                <span class="toggle-switch"></span>
                <span>{t("event.create.allowMaybeLabel")}</span>
            </label>
        </div>

        <!-- Error -->
        {#if error}
            <div class="error-message" role="alert">{error}</div>
        {/if}

        <!-- Submit -->
        <button
            type="submit"
            class="btn btn-primary submit-btn"
            disabled={!isValid || submitting}
        >
            {submitting ? t("event.create.creating") : t("event.create.submit")}
        </button>
    </form>
</div>

<style>
    .hero {
        text-align: center;
        padding: 2rem 0 2.5rem;
    }

    .hero h1 {
        font-size: 2.5rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        margin-bottom: 0.5rem;
    }

    .hero-tagline {
        font-size: 1.125rem;
        color: var(--fg-muted);
    }

    .create-form {
        max-width: 520px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-bottom: 3rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
    }

    .form-hint {
        font-size: 0.8125rem;
        color: var(--fg-muted);
        margin-bottom: 0.5rem;
    }

    .calendar-container {
        padding: 1rem;
    }

    .time-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .time-row > :global(.time-picker) {
        flex: 1;
    }

    .time-separator {
        padding-bottom: 0.75rem;
        color: var(--fg-muted);
        font-size: 0.875rem;
    }

    .granularity-pills {
        display: flex;
        gap: 0.5rem;
    }

    .pill {
        flex: 1;
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--fg-secondary);
        font-size: 0.875rem;
        font-family: inherit;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 40px;
    }

    .pill:hover {
        background-color: var(--bg-hover);
    }

    .pill.active {
        background-color: var(--interactive);
        color: var(--bg-primary);
        border-color: var(--interactive);
        font-weight: 500;
    }

    /* Toggle switch */
    .toggle-group {
        flex-direction: row;
    }

    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        font-size: 0.9375rem;
        color: var(--fg-secondary);
        user-select: none;
    }

    .toggle-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        background-color: var(--bg-hover);
        border-radius: var(--radius-full);
        transition: background-color var(--transition-fast);
        flex-shrink: 0;
    }

    .toggle-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background-color: var(--fg-primary);
        border-radius: 50%;
        transition: transform var(--transition-fast);
    }

    .toggle-input:checked + .toggle-switch {
        background-color: var(--interactive);
    }

    .toggle-input:checked + .toggle-switch::after {
        transform: translateX(20px);
    }

    .toggle-input:focus-visible + .toggle-switch {
        box-shadow: var(--focus-ring);
    }

    .error-message {
        padding: 0.75rem 1rem;
        background-color: rgba(205, 172, 172, 0.1);
        border: 1px solid var(--accent-red);
        border-radius: var(--radius-md);
        color: var(--accent-red);
        font-size: 0.875rem;
    }

    .submit-btn {
        width: 100%;
        padding: 0.75rem;
        font-size: 1rem;
        font-weight: 600;
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @media (max-width: 640px) {
        .hero {
            padding: 1.5rem 0 2rem;
        }

        .hero h1 {
            font-size: 2rem;
        }

        .hero-tagline {
            font-size: 1rem;
        }

        .create-form {
            gap: 1.25rem;
        }
    }
</style>
