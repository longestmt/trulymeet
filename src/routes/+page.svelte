<script lang="ts">
    import Calendar from "$lib/components/Calendar.svelte";
    import TimePicker from "$lib/components/TimePicker.svelte";
    import { detectTimezone } from "$lib/utils/timezone";
    import { t } from "$lib/i18n";

    // TimeBlock local type
    type TimeBlock = {
        startTime: string;
        endTime: string;
        days: string[];
    };

    // Form state
    let title = $state("");
    let description = $state("");
    let selectedDates = $state<string[]>([]);
    let timeBlocks = $state<TimeBlock[]>([
        { startTime: "09:00", endTime: "17:00", days: [] },
    ]);
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

    // When selectedDates changes, auto-assign new dates to first block
    // and remove stale dates from all blocks
    import { untrack } from "svelte";
    $effect(() => {
        const dateSet = new Set(selectedDates);
        // Use untrack for timeBlocks to avoid infinite reactivity loop
        untrack(() => {
            // Remove stale dates
            for (const block of timeBlocks) {
                block.days = block.days.filter((d) => dateSet.has(d));
            }
            // Any new dates not in any block go to the first block
            const assignedDates = new Set(timeBlocks.flatMap((b) => b.days));
            const unassigned = selectedDates.filter(
                (d) => !assignedDates.has(d),
            );
            if (unassigned.length > 0 && timeBlocks.length > 0) {
                timeBlocks[0].days = [
                    ...new Set([...timeBlocks[0].days, ...unassigned]),
                ].sort();
            }
        });
    });

    // Helper: get weekday label for a date string
    function getWeekdayShort(dateStr: string): string {
        const d = new Date(dateStr + "T12:00:00");
        return d.toLocaleDateString("en-US", { weekday: "short" });
    }

    // Helper: format date for chip display
    function formatDateChip(dateStr: string): string {
        const d = new Date(dateStr + "T12:00:00");
        return d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    }

    // Check if all dates are covered by at least one block
    let allDatesCovered = $derived(
        selectedDates.length === 0 ||
            selectedDates.every((d) =>
                timeBlocks.some((b) => b.days.includes(d)),
            ),
    );

    // Validation
    let isValid = $derived(
        title.trim().length > 0 &&
            selectedDates.length > 0 &&
            timeBlocks.length > 0 &&
            timeBlocks.every(
                (b) =>
                    b.startTime < b.endTime && b.days.length > 0,
            ) &&
            allDatesCovered,
    );

    function addTimeBlock() {
        timeBlocks = [
            ...timeBlocks,
            { startTime: "09:00", endTime: "17:00", days: [] },
        ];
    }

    function removeTimeBlock(index: number) {
        if (timeBlocks.length <= 1) return;
        const removed = timeBlocks[index];
        const remaining = timeBlocks.filter((_, i) => i !== index);
        // Move orphaned days to the first remaining block
        const remainingDays = new Set(remaining.flatMap((b) => b.days));
        const orphans = removed.days.filter((d) => !remainingDays.has(d));
        if (orphans.length > 0) {
            remaining[0].days = [
                ...new Set([...remaining[0].days, ...orphans]),
            ].sort();
        }
        timeBlocks = remaining;
    }

    function toggleDayInBlock(blockIndex: number, dateStr: string) {
        const block = timeBlocks[blockIndex];
        if (block.days.includes(dateStr)) {
            block.days = block.days.filter((d) => d !== dateStr);
        } else {
            block.days = [...block.days, dateStr].sort();
        }
        timeBlocks = [...timeBlocks]; // trigger reactivity
    }

    function selectAllDaysInBlock(blockIndex: number) {
        timeBlocks[blockIndex].days = [...selectedDates];
        timeBlocks = [...timeBlocks];
    }

    function clearDaysInBlock(blockIndex: number) {
        timeBlocks[blockIndex].days = [];
        timeBlocks = [...timeBlocks];
    }

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
                    timeBlocks,
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

        <!-- Time ranges -->
        <div class="form-group">
            <span class="label">{t("event.create.timeBlocksLabel")}</span>
            <p class="form-hint">{t("event.create.timeBlocksHint")}</p>

            <div class="timeblocks-list">
                {#each timeBlocks as block, i}
                    <div class="timeblock-card card">
                        <div class="timeblock-header">
                            <span class="timeblock-title"
                                >{t("event.create.timeRangeTitle")} {timeBlocks.length >
                                1
                                    ? i + 1
                                    : ""}</span
                            >
                            {#if timeBlocks.length > 1}
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-sm btn-danger"
                                    onclick={() => removeTimeBlock(i)}
                                >
                                    {t("event.create.removeTimeRange")}
                                </button>
                            {/if}
                        </div>

                        <div class="time-row">
                            <TimePicker
                                bind:value={block.startTime}
                                label={t("event.create.startTimeLabel")}
                                id="start-time-{i}"
                            />
                            <span class="time-separator">to</span>
                            <TimePicker
                                bind:value={block.endTime}
                                label={t("event.create.endTimeLabel")}
                                id="end-time-{i}"
                            />
                        </div>

                        {#if block.startTime >= block.endTime}
                            <p class="field-error">End time must be after start time</p>
                        {/if}

                        <!-- Day assignment chips -->
                        {#if selectedDates.length > 0}
                            <div class="day-assignment">
                                <div class="day-assignment-header">
                                    <span class="day-assignment-label"
                                        >{t("event.create.daysForBlock")}</span
                                    >
                                    <div class="day-assignment-actions">
                                        <button
                                            type="button"
                                            class="btn btn-ghost btn-xs"
                                            onclick={() =>
                                                selectAllDaysInBlock(i)}
                                        >
                                            {t("event.create.allDays")}
                                        </button>
                                        <button
                                            type="button"
                                            class="btn btn-ghost btn-xs"
                                            onclick={() =>
                                                clearDaysInBlock(i)}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div class="day-chips">
                                    {#each selectedDates as dateStr}
                                        <button
                                            type="button"
                                            class="day-chip"
                                            class:selected={block.days.includes(
                                                dateStr,
                                            )}
                                            onclick={() =>
                                                toggleDayInBlock(i, dateStr)}
                                            title={formatDateChip(dateStr)}
                                        >
                                            <span class="day-chip-weekday"
                                                >{getWeekdayShort(
                                                    dateStr,
                                                )}</span
                                            >
                                            <span class="day-chip-date"
                                                >{new Date(dateStr + "T12:00:00").getDate()}</span
                                            >
                                        </button>
                                    {/each}
                                </div>
                                {#if block.days.length === 0}
                                    <p class="field-error">Select at least one day</p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}

                <button
                    type="button"
                    class="btn btn-ghost add-timeblock-btn"
                    onclick={addTimeBlock}
                >
                    {t("event.create.addTimeRange")}
                </button>
            </div>

            {#if !allDatesCovered && selectedDates.length > 0}
                <p class="field-error">{t("event.create.uncoveredDatesWarning")}</p>
            {/if}
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

    /* Timeblocks */
    .timeblocks-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .timeblock-card {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .timeblock-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .timeblock-title {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--fg-primary);
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

    /* Day assignment */
    .day-assignment {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .day-assignment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .day-assignment-label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--fg-secondary);
    }

    .day-assignment-actions {
        display: flex;
        gap: 0.25rem;
    }

    .day-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
    }

    .day-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--fg-secondary);
        font-family: inherit;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-width: 44px;
        gap: 0.125rem;
    }

    .day-chip:hover {
        background-color: var(--bg-hover);
    }

    .day-chip.selected {
        background-color: var(--interactive);
        color: var(--bg-primary);
        border-color: var(--interactive);
    }

    .day-chip-weekday {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .day-chip-date {
        font-size: 0.8125rem;
        font-weight: 500;
    }

    .field-error {
        font-size: 0.75rem;
        color: var(--accent-red, #e53e3e);
        margin-top: 0.25rem;
    }

    .add-timeblock-btn {
        width: 100%;
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        color: var(--fg-muted);
    }

    .add-timeblock-btn:hover {
        border-color: var(--interactive);
        color: var(--interactive);
    }

    .btn-danger {
        color: var(--accent-red, #e53e3e);
    }

    .btn-danger:hover {
        background-color: rgba(229, 62, 62, 0.1);
    }

    .btn-xs {
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        min-height: auto;
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
