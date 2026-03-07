<script lang="ts">
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import { t } from "$lib/i18n";
    import {
        detectTimezone,
        formatTime,
        formatDate,
    } from "$lib/utils/timezone";

    let slug = $derived($page.params.slug);

    // Event data
    let event = $state<{
        title: string;
        description: string | null;
        timezone: string;
        timeGranularityMinutes: number;
        candidateDates: string[];
        startTime: string;
        endTime: string;
        allowMaybe: boolean;
        locked: boolean;
        hasPassword: boolean;
    } | null>(null);

    // Participant data from server
    let allParticipants = $state<
        {
            id: string;
            displayName: string;
            slots: { slotStart: string; status: "available" | "maybe" }[];
        }[]
    >([]);

    // Current user state
    let participantName = $state("");
    let participantId = $state<string | null>(null);
    let activeTab = $state<"availability" | "results">("availability");
    let userTimezone = $state("UTC");

    // Mobile: current day index
    let currentDayIndex = $state(0);

    // Availability state: Map of slotStart ISO string → status
    let mySlots = $state<Map<string, "available" | "maybe">>(new Map());

    // Undo/redo
    let undoStack = $state<Map<string, "available" | "maybe">[]>([]);
    let redoStack = $state<Map<string, "available" | "maybe">[]>([]);
    const MAX_UNDO = 20;

    // Save state
    let saveStatus = $state<"idle" | "saving" | "saved">("idle");
    let saveTimeout: ReturnType<typeof setTimeout>;
    let saveIndicatorTimeout: ReturnType<typeof setTimeout>;

    // SSE connection
    let eventSource: EventSource | null = null;

    // Password protection
    let needsPassword = $state(false);
    let passwordInput = $state("");
    let passwordError = $state("");

    // Loading state
    let loading = $state(true);

    // Responsive
    let isMobile = $state(false);

    // Highlighted participant in results
    let highlightedParticipant = $state<string | null>(null);

    onMount(async () => {
        userTimezone = detectTimezone();
        isMobile = window.innerWidth < 768;
        window.addEventListener("resize", handleResize);

        await loadEvent();
    });

    onDestroy(() => {
        if (eventSource) eventSource.close();
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", handleResize);
        }
    });

    function handleResize() {
        isMobile = window.innerWidth < 768;
    }

    async function loadEvent() {
        try {
            const res = await fetch(`/api/events/${slug}`);
            if (!res.ok) {
                loading = false;
                return;
            }

            const data = await res.json();
            event = data;

            if (data.hasPassword) {
                // Check if we have an access token
                const token = localStorage.getItem(`trulymeet-access-${slug}`);
                if (!token) {
                    needsPassword = true;
                    loading = false;
                    return;
                }
            }

            await loadParticipants();
            connectSSE();
            loading = false;
        } catch {
            loading = false;
        }
    }

    async function loadParticipants() {
        try {
            const res = await fetch(`/api/events/${slug}/participants`);
            if (res.ok) {
                const data = await res.json();
                allParticipants = data.participants;
            }
        } catch {
            // Silent failure
        }
    }

    function connectSSE() {
        eventSource = new EventSource(`/api/events/${slug}/stream`);

        eventSource.addEventListener("availability_updated", () => {
            loadParticipants();
        });

        eventSource.addEventListener("participant_joined", () => {
            loadParticipants();
        });

        eventSource.addEventListener("participant_removed", () => {
            loadParticipants();
        });

        eventSource.onerror = () => {
            // Reconnect after 5 seconds
            setTimeout(() => {
                if (eventSource) eventSource.close();
                connectSSE();
            }, 5000);
        };
    }

    // ─── Time slots generation ───────────────────────────
    let timeSlots = $derived.by(() => {
        if (!event) return [];

        const [startH, startM] = event.startTime.split(":").map(Number);
        const [endH, endM] = event.endTime.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const slots: { label: string; minutes: number }[] = [];

        for (
            let m = startMinutes;
            m < endMinutes;
            m += event.timeGranularityMinutes
        ) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm = h < 12 ? "AM" : "PM";
            slots.push({
                label: `${hour12}:${String(min).padStart(2, "0")} ${ampm}`,
                minutes: m,
            });
        }

        return slots;
    });

    // Generate slot key from date and time
    function getSlotKey(dateStr: string, minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
    }

    // ─── Slot toggling ───────────────────────────────────
    function pushUndo() {
        undoStack = [...undoStack.slice(-(MAX_UNDO - 1)), new Map(mySlots)];
        redoStack = [];
    }

    function toggleSlot(dateStr: string, minutes: number) {
        pushUndo();
        const key = getSlotKey(dateStr, minutes);
        const current = mySlots.get(key);

        const newSlots = new Map(mySlots);

        if (!current) {
            newSlots.set(key, "available");
        } else if (current === "available" && event?.allowMaybe) {
            newSlots.set(key, "maybe");
        } else {
            newSlots.delete(key);
        }

        mySlots = newSlots;
        scheduleSave();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack = [...redoStack, new Map(mySlots)];
        const prev = undoStack[undoStack.length - 1];
        undoStack = undoStack.slice(0, -1);
        mySlots = prev;
        scheduleSave();
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack = [...undoStack, new Map(mySlots)];
        const next = redoStack[redoStack.length - 1];
        redoStack = redoStack.slice(0, -1);
        mySlots = next;
        scheduleSave();
    }

    function selectAllDay(dateStr: string) {
        pushUndo();
        const newSlots = new Map(mySlots);
        for (const slot of timeSlots) {
            const key = getSlotKey(dateStr, slot.minutes);
            newSlots.set(key, "available");
        }
        mySlots = newSlots;
        scheduleSave();
    }

    function clearDay(dateStr: string) {
        pushUndo();
        const newSlots = new Map(mySlots);
        for (const slot of timeSlots) {
            const key = getSlotKey(dateStr, slot.minutes);
            newSlots.delete(key);
        }
        mySlots = newSlots;
        scheduleSave();
    }

    function copyToOtherDays(fromDateStr: string) {
        if (!event) return;
        pushUndo();
        const newSlots = new Map(mySlots);

        // Get slots for the source day
        const sourceSlots = timeSlots
            .map((slot) => ({
                minutes: slot.minutes,
                status: mySlots.get(getSlotKey(fromDateStr, slot.minutes)),
            }))
            .filter((s) => s.status);

        // Apply to all other days
        for (const dateStr of event.candidateDates) {
            if (dateStr === fromDateStr) continue;
            // Clear existing
            for (const slot of timeSlots) {
                newSlots.delete(getSlotKey(dateStr, slot.minutes));
            }
            // Copy from source
            for (const s of sourceSlots) {
                newSlots.set(getSlotKey(dateStr, s.minutes), s.status!);
            }
        }

        mySlots = newSlots;
        scheduleSave();
    }

    // ─── Auto-save ───────────────────────────────────────
    function scheduleSave() {
        clearTimeout(saveTimeout);
        saveStatus = "saving";
        saveTimeout = setTimeout(() => saveAvailability(), 500);
    }

    async function saveAvailability() {
        if (!participantId) return;

        const slots = Array.from(mySlots.entries()).map(
            ([slotStart, status]) => ({
                slotStart,
                status,
            }),
        );

        try {
            const res = await fetch(
                `/api/events/${slug}/participants/${participantId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slots }),
                },
            );

            if (res.ok) {
                saveStatus = "saved";
                clearTimeout(saveIndicatorTimeout);
                saveIndicatorTimeout = setTimeout(() => {
                    saveStatus = "idle";
                }, 2000);
            }
        } catch {
            saveStatus = "idle";
        }
    }

    // ─── Join event ──────────────────────────────────────
    let joining = $state(false);

    async function joinEvent() {
        if (!participantName.trim() || joining) return;
        joining = true;

        try {
            const slots = Array.from(mySlots.entries()).map(
                ([slotStart, status]) => ({
                    slotStart,
                    status,
                }),
            );

            const res = await fetch(`/api/events/${slug}/participants`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName: participantName.trim(),
                    slots,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                participantId = data.id;
                await loadParticipants();
            }
        } catch {
            // Error handling
        } finally {
            joining = false;
        }
    }

    // ─── Results helpers ─────────────────────────────────
    function getSlotParticipants(
        dateStr: string,
        minutes: number,
    ): { available: string[]; maybe: string[] } {
        const key = getSlotKey(dateStr, minutes);
        const available: string[] = [];
        const maybe: string[] = [];

        for (const p of allParticipants) {
            for (const s of p.slots) {
                if (s.slotStart === key) {
                    if (s.status === "available") available.push(p.displayName);
                    else if (s.status === "maybe") maybe.push(p.displayName);
                }
            }
        }

        return { available, maybe };
    }

    function getSlotCount(dateStr: string, minutes: number): number {
        const { available, maybe } = getSlotParticipants(dateStr, minutes);
        return available.length + maybe.length;
    }

    let maxParticipants = $derived(allParticipants.length || 1);

    function getHeatmapOpacity(count: number): number {
        return count / maxParticipants;
    }

    // Best times calculation
    let bestTimes = $derived.by(() => {
        if (!event || allParticipants.length === 0) return [];

        const slotCounts: {
            dateStr: string;
            minutes: number;
            count: number;
            available: number;
            total: number;
        }[] = [];

        for (const dateStr of event.candidateDates) {
            for (const slot of timeSlots) {
                const { available, maybe } = getSlotParticipants(
                    dateStr,
                    slot.minutes,
                );
                const count = available.length + maybe.length;
                if (count > 0) {
                    slotCounts.push({
                        dateStr,
                        minutes: slot.minutes,
                        count,
                        available: available.length,
                        total: allParticipants.length,
                    });
                }
            }
        }

        // Sort by count descending, take top 5
        slotCounts.sort((a, b) => b.count - a.count);

        // Merge adjacent slots
        const merged: {
            dateStr: string;
            startMinutes: number;
            endMinutes: number;
            count: number;
            total: number;
        }[] = [];

        for (const slot of slotCounts.slice(0, 15)) {
            const last = merged[merged.length - 1];
            if (
                last &&
                last.dateStr === slot.dateStr &&
                last.endMinutes === slot.minutes &&
                last.count === slot.count
            ) {
                last.endMinutes =
                    slot.minutes + (event?.timeGranularityMinutes ?? 15);
            } else {
                merged.push({
                    dateStr: slot.dateStr,
                    startMinutes: slot.minutes,
                    endMinutes:
                        slot.minutes + (event?.timeGranularityMinutes ?? 15),
                    count: slot.count,
                    total: slot.total,
                });
            }
        }

        return merged.slice(0, 5);
    });

    function formatMinutes(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const ampm = h < 12 ? "AM" : "PM";
        return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    }

    function formatDateStr(dateStr: string): string {
        const d = new Date(dateStr + "T12:00:00");
        return d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    }

    // Navigation
    function prevDay() {
        if (event && currentDayIndex > 0) currentDayIndex--;
    }

    function nextDay() {
        if (event && currentDayIndex < event.candidateDates.length - 1)
            currentDayIndex++;
    }

    // Current day for mobile view
    let currentDate = $derived(event?.candidateDates[currentDayIndex] ?? "");

    // Day has selections indicator
    function dayHasSlots(dateStr: string): boolean {
        return timeSlots.some((slot) =>
            mySlots.has(getSlotKey(dateStr, slot.minutes)),
        );
    }

    // Keyboard shortcuts
    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "y") {
            e.preventDefault();
            redo();
        }
    }

    // Tooltip state
    let tooltip = $state<{
        x: number;
        y: number;
        available: string[];
        maybe: string[];
        visible: boolean;
    }>({
        x: 0,
        y: 0,
        available: [],
        maybe: [],
        visible: false,
    });

    function showTooltip(e: MouseEvent, dateStr: string, minutes: number) {
        const { available, maybe } = getSlotParticipants(dateStr, minutes);
        tooltip = {
            x: e.clientX,
            y: e.clientY,
            available,
            maybe,
            visible: true,
        };
    }

    function hideTooltip() {
        tooltip = { ...tooltip, visible: false };
    }
</script>

<svelte:head>
    <title>{event?.title ?? "Event"} — TrulyMeet</title>
    {#if event}
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content="Find a time on TrulyMeet" />
    {/if}
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
    {#if loading}
        <div class="loading-state">
            <p>{t("common.loading")}</p>
        </div>
    {:else if !event}
        <div class="error-state">
            <h1>Event not found</h1>
            <p>This event may have expired or the link is incorrect.</p>
            <a href="/" class="btn btn-primary">Create a new event</a>
        </div>
    {:else if needsPassword}
        <!-- Password gate -->
        <div class="password-gate animate-fade-in">
            <h1>{event.title}</h1>
            <p>This event is password-protected.</p>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                }}
            >
                <input
                    class="input"
                    type="password"
                    bind:value={passwordInput}
                    placeholder={t("event.join.passwordPlaceholder")}
                />
                {#if passwordError}
                    <p class="error-text">{passwordError}</p>
                {/if}
                <button class="btn btn-primary" type="submit"
                    >{t("event.join.unlock")}</button
                >
            </form>
        </div>
    {:else}
        <!-- Main event page -->
        <div class="event-page animate-fade-in">
            <!-- Event header -->
            <div class="event-header">
                <h1>{event.title}</h1>
                {#if event.description}
                    <p class="event-desc">{event.description}</p>
                {/if}
                <div class="event-meta">
                    <span>{event.candidateDates.length} days</span>
                    <span>·</span>
                    <span
                        >{allParticipants.length} participant{allParticipants.length !==
                        1
                            ? "s"
                            : ""}</span
                    >
                    {#if event.locked}
                        <span class="locked-badge">🔒 Locked</span>
                    {/if}
                </div>
            </div>

            <!-- Name entry (if not joined) -->
            {#if !participantId}
                <div class="name-entry card">
                    <label class="label" for="participant-name"
                        >{t("event.join.nameLabel")}</label
                    >
                    <div class="name-row">
                        <input
                            id="participant-name"
                            class="input"
                            type="text"
                            bind:value={participantName}
                            placeholder={t("event.join.namePlaceholder")}
                            maxlength={50}
                        />
                        <button
                            class="btn btn-primary"
                            onclick={joinEvent}
                            disabled={!participantName.trim() ||
                                joining ||
                                event.locked}
                        >
                            Join
                        </button>
                    </div>
                </div>
            {/if}

            <!-- Tabs -->
            <div class="tabs" role="tablist">
                <button
                    class="tab"
                    class:active={activeTab === "availability"}
                    role="tab"
                    aria-selected={activeTab === "availability"}
                    onclick={() => (activeTab = "availability")}
                >
                    {t("event.availability.tabYours")}
                </button>
                <button
                    class="tab"
                    class:active={activeTab === "results"}
                    role="tab"
                    aria-selected={activeTab === "results"}
                    onclick={() => (activeTab = "results")}
                >
                    {t("event.availability.tabResults")}
                    {#if allParticipants.length > 0}
                        <span class="tab-badge">{allParticipants.length}</span>
                    {/if}
                </button>
            </div>

            <!-- Availability tab (mobile: single day) -->
            {#if activeTab === "availability"}
                <div class="availability-section">
                    <!-- Save indicator + undo/redo -->
                    {#if participantId}
                        <div class="toolbar">
                            <div class="toolbar-left">
                                <button
                                    class="btn btn-ghost btn-sm"
                                    onclick={undo}
                                    disabled={undoStack.length === 0}
                                    title="Undo (Ctrl+Z)"
                                >
                                    ↶ {t("event.availability.undo")}
                                </button>
                                <button
                                    class="btn btn-ghost btn-sm"
                                    onclick={redo}
                                    disabled={redoStack.length === 0}
                                    title="Redo (Ctrl+Y)"
                                >
                                    ↷ {t("event.availability.redo")}
                                </button>
                            </div>
                            <div
                                class="save-indicator"
                                class:visible={saveStatus !== "idle"}
                            >
                                {#if saveStatus === "saving"}
                                    {t("event.availability.saving")}
                                {:else if saveStatus === "saved"}
                                    ✓ {t("event.availability.saved")}
                                {/if}
                            </div>
                        </div>
                    {/if}

                    {#if isMobile}
                        <!-- Mobile: single day view -->
                        <div class="day-nav">
                            <button
                                class="btn btn-ghost btn-icon"
                                onclick={prevDay}
                                disabled={currentDayIndex === 0}>←</button
                            >
                            <div class="day-tabs">
                                {#each event.candidateDates as dateStr, i}
                                    <button
                                        class="day-tab"
                                        class:active={i === currentDayIndex}
                                        class:has-slots={dayHasSlots(dateStr)}
                                        onclick={() => (currentDayIndex = i)}
                                    >
                                        {formatDateStr(dateStr).split(",")[0]}
                                    </button>
                                {/each}
                            </div>
                            <button
                                class="btn btn-ghost btn-icon"
                                onclick={nextDay}
                                disabled={currentDayIndex ===
                                    event.candidateDates.length - 1}>→</button
                            >
                        </div>

                        <h3 class="day-title">{formatDateStr(currentDate)}</h3>

                        <!-- Day actions -->
                        {#if participantId}
                            <div class="day-actions">
                                <button
                                    class="btn btn-ghost btn-sm"
                                    onclick={() => selectAllDay(currentDate)}
                                    >{t("event.availability.selectAll")}</button
                                >
                                <button
                                    class="btn btn-ghost btn-sm"
                                    onclick={() => clearDay(currentDate)}
                                    >{t("event.availability.clearDay")}</button
                                >
                                <button
                                    class="btn btn-ghost btn-sm"
                                    onclick={() => copyToOtherDays(currentDate)}
                                    >{t(
                                        "event.availability.copyToOther",
                                    )}</button
                                >
                            </div>
                        {/if}

                        <!-- Mobile slot list -->
                        <div class="slot-list">
                            {#each timeSlots as slot}
                                {@const key = getSlotKey(
                                    currentDate,
                                    slot.minutes,
                                )}
                                {@const status = mySlots.get(key)}
                                {@const count = getSlotCount(
                                    currentDate,
                                    slot.minutes,
                                )}
                                <button
                                    class="slot-row"
                                    class:available={status === "available"}
                                    class:maybe={status === "maybe"}
                                    class:disabled={!participantId}
                                    disabled={!participantId}
                                    onclick={() =>
                                        toggleSlot(currentDate, slot.minutes)}
                                    aria-label="{formatDateStr(
                                        currentDate,
                                    )}, {slot.label}, {status || 'unavailable'}"
                                >
                                    <span class="slot-time">{slot.label}</span>
                                    <div class="slot-indicators">
                                        {#if count > 0}
                                            <span class="slot-count"
                                                >{count}</span
                                            >
                                        {/if}
                                        <span class="slot-status-icon">
                                            {#if status === "available"}✓{:else if status === "maybe"}?{/if}
                                        </span>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <!-- Desktop: full grid -->
                        <div class="grid-container">
                            <div class="grid-scroll">
                                <table class="availability-grid" role="grid">
                                    <thead>
                                        <tr>
                                            <th class="time-header"></th>
                                            {#each event.candidateDates as dateStr}
                                                <th class="date-header">
                                                    <span class="date-day"
                                                        >{formatDateStr(
                                                            dateStr,
                                                        ).split(",")[0]}</span
                                                    >
                                                    <span class="date-num"
                                                        >{formatDateStr(dateStr)
                                                            .split(" ")
                                                            .slice(1)
                                                            .join(" ")}</span
                                                    >
                                                </th>
                                            {/each}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each timeSlots as slot}
                                            <tr>
                                                <td class="time-label"
                                                    >{slot.label}</td
                                                >
                                                {#each event.candidateDates as dateStr}
                                                    {@const key = getSlotKey(
                                                        dateStr,
                                                        slot.minutes,
                                                    )}
                                                    {@const status =
                                                        mySlots.get(key)}
                                                    <td
                                                        class="grid-cell"
                                                        class:available={status ===
                                                            "available"}
                                                        class:maybe={status ===
                                                            "maybe"}
                                                        class:disabled={!participantId}
                                                        role="gridcell"
                                                        aria-label="{formatDateStr(
                                                            dateStr,
                                                        )}, {slot.label}, {status ||
                                                            'unavailable'}"
                                                        onclick={() => {
                                                            if (participantId)
                                                                toggleSlot(
                                                                    dateStr,
                                                                    slot.minutes,
                                                                );
                                                        }}
                                                        onkeydown={(e) => {
                                                            if (
                                                                e.key === " " ||
                                                                e.key ===
                                                                    "Enter"
                                                            ) {
                                                                e.preventDefault();
                                                                if (
                                                                    participantId
                                                                )
                                                                    toggleSlot(
                                                                        dateStr,
                                                                        slot.minutes,
                                                                    );
                                                            }
                                                        }}
                                                        tabindex={participantId
                                                            ? 0
                                                            : -1}
                                                    >
                                                        {#if status === "available"}
                                                            <span
                                                                class="cell-icon"
                                                                >✓</span
                                                            >
                                                        {:else if status === "maybe"}
                                                            <span
                                                                class="cell-icon"
                                                                >?</span
                                                            >
                                                        {/if}
                                                    </td>
                                                {/each}
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Day actions for desktop -->
                            {#if participantId}
                                <div class="desktop-day-actions">
                                    {#each event.candidateDates as dateStr}
                                        <div class="day-action-col">
                                            <button
                                                class="btn btn-ghost btn-sm"
                                                onclick={() =>
                                                    selectAllDay(dateStr)}
                                                title="Select all">All</button
                                            >
                                            <button
                                                class="btn btn-ghost btn-sm"
                                                onclick={() =>
                                                    clearDay(dateStr)}
                                                title="Clear">Clear</button
                                            >
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {:else}
                <!-- Results tab -->
                <div class="results-section">
                    {#if allParticipants.length === 0}
                        <div class="empty-state card">
                            <p>{t("event.results.noResponses")}</p>
                        </div>
                    {:else}
                        <!-- Best times -->
                        <div class="best-times">
                            <h2>{t("event.results.bestTimes")}</h2>
                            {#if bestTimes.length > 0}
                                <div class="best-times-list">
                                    {#each bestTimes as bt, i}
                                        <div class="best-time-card card">
                                            <span class="best-time-rank"
                                                >#{i + 1}</span
                                            >
                                            <div class="best-time-info">
                                                <span class="best-time-date"
                                                    >{formatDateStr(
                                                        bt.dateStr,
                                                    )}</span
                                                >
                                                <span class="best-time-range"
                                                    >{formatMinutes(
                                                        bt.startMinutes,
                                                    )} – {formatMinutes(
                                                        bt.endMinutes,
                                                    )}</span
                                                >
                                            </div>
                                            <span class="best-time-count"
                                                >{bt.count}/{bt.total}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <!-- Heatmap grid -->
                        <div class="heatmap-section">
                            <h3>Group Availability</h3>
                            {#if isMobile}
                                <!-- Mobile heatmap: one day at a time -->
                                <div class="day-nav">
                                    <button
                                        class="btn btn-ghost btn-icon"
                                        onclick={prevDay}
                                        disabled={currentDayIndex === 0}
                                        >←</button
                                    >
                                    <span class="day-title"
                                        >{formatDateStr(currentDate)}</span
                                    >
                                    <button
                                        class="btn btn-ghost btn-icon"
                                        onclick={nextDay}
                                        disabled={currentDayIndex ===
                                            event.candidateDates.length - 1}
                                        >→</button
                                    >
                                </div>

                                <div class="slot-list">
                                    {#each timeSlots as slot}
                                        {@const count = getSlotCount(
                                            currentDate,
                                            slot.minutes,
                                        )}
                                        {@const opacity =
                                            getHeatmapOpacity(count)}
                                        <button
                                            class="slot-row heatmap-row"
                                            style="--heat: {opacity}"
                                            onclick={(e) =>
                                                showTooltip(
                                                    e,
                                                    currentDate,
                                                    slot.minutes,
                                                )}
                                        >
                                            <span class="slot-time"
                                                >{slot.label}</span
                                            >
                                            <div class="slot-indicators">
                                                <span class="slot-count"
                                                    >{count}/{allParticipants.length}</span
                                                >
                                                <div
                                                    class="heat-bar"
                                                    style="width: {opacity *
                                                        100}%"
                                                ></div>
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            {:else}
                                <!-- Desktop heatmap -->
                                <div class="grid-scroll">
                                    <table
                                        class="availability-grid heatmap"
                                        role="grid"
                                    >
                                        <thead>
                                            <tr>
                                                <th class="time-header"></th>
                                                {#each event.candidateDates as dateStr}
                                                    <th class="date-header">
                                                        <span class="date-day"
                                                            >{formatDateStr(
                                                                dateStr,
                                                            ).split(
                                                                ",",
                                                            )[0]}</span
                                                        >
                                                        <span class="date-num"
                                                            >{formatDateStr(
                                                                dateStr,
                                                            )
                                                                .split(" ")
                                                                .slice(1)
                                                                .join(
                                                                    " ",
                                                                )}</span
                                                        >
                                                    </th>
                                                {/each}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each timeSlots as slot}
                                                <tr>
                                                    <td class="time-label"
                                                        >{slot.label}</td
                                                    >
                                                    {#each event.candidateDates as dateStr}
                                                        {@const count =
                                                            getSlotCount(
                                                                dateStr,
                                                                slot.minutes,
                                                            )}
                                                        {@const opacity =
                                                            getHeatmapOpacity(
                                                                count,
                                                            )}
                                                        <td
                                                            class="grid-cell heatmap-cell"
                                                            style="--heat: {opacity}"
                                                            role="gridcell"
                                                            onmouseenter={(e) =>
                                                                showTooltip(
                                                                    e,
                                                                    dateStr,
                                                                    slot.minutes,
                                                                )}
                                                            onmouseleave={hideTooltip}
                                                        >
                                                            {#if count > 0}
                                                                <span
                                                                    class="cell-count"
                                                                    >{count}</span
                                                                >
                                                            {/if}
                                                        </td>
                                                    {/each}
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {/if}
                        </div>

                        <!-- Participant list -->
                        <div class="participant-list">
                            <h3>{t("event.results.participants")}</h3>
                            {#each allParticipants as p}
                                <button
                                    class="participant-row"
                                    class:highlighted={highlightedParticipant ===
                                        p.id}
                                    onclick={() =>
                                        (highlightedParticipant =
                                            highlightedParticipant === p.id
                                                ? null
                                                : p.id)}
                                >
                                    <span class="participant-name"
                                        >{p.displayName}</span
                                    >
                                    <span class="participant-slots"
                                        >{p.slots.length} slots</span
                                    >
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Tooltip -->
        {#if tooltip.visible}
            <div
                class="tooltip"
                style="left: {tooltip.x + 12}px; top: {tooltip.y + 12}px"
            >
                {#if tooltip.available.length > 0}
                    <div class="tooltip-group">
                        <span class="tooltip-label">✓ Available:</span>
                        {#each tooltip.available as name}
                            <span class="tooltip-name">{name}</span>
                        {/each}
                    </div>
                {/if}
                {#if tooltip.maybe.length > 0}
                    <div class="tooltip-group">
                        <span class="tooltip-label">? Maybe:</span>
                        {#each tooltip.maybe as name}
                            <span class="tooltip-name">{name}</span>
                        {/each}
                    </div>
                {/if}
                {#if tooltip.available.length === 0 && tooltip.maybe.length === 0}
                    <span class="tooltip-label">No one available</span>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    /* ─── Event header ──────────────────────────────────── */
    .event-header {
        text-align: center;
        margin-bottom: 1.5rem;
    }

    .event-desc {
        margin-top: 0.5rem;
        font-size: 0.9375rem;
    }

    .event-meta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.75rem;
        font-size: 0.8125rem;
        color: var(--fg-muted);
    }

    .locked-badge {
        color: var(--accent-yellow);
    }

    /* ─── Name entry ────────────────────────────────────── */
    .name-entry {
        margin-bottom: 1.5rem;
    }

    .name-row {
        display: flex;
        gap: 0.5rem;
    }

    .name-row .input {
        flex: 1;
    }

    /* ─── Tabs ──────────────────────────────────────────── */
    .tabs {
        display: flex;
        border-bottom: 1px solid var(--border-subtle);
        margin-bottom: 1.5rem;
    }

    .tab {
        flex: 1;
        padding: 0.75rem;
        border: none;
        background: transparent;
        color: var(--fg-muted);
        font-size: 0.9375rem;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: all var(--transition-fast);
        border-bottom: 2px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .tab.active {
        color: var(--fg-primary);
        border-bottom-color: var(--interactive);
    }

    .tab-badge {
        background-color: var(--bg-surface);
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
    }

    /* ─── Toolbar ───────────────────────────────────────── */
    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .toolbar-left {
        display: flex;
        gap: 0.25rem;
    }

    .save-indicator {
        font-size: 0.8125rem;
        color: var(--accent-green);
        opacity: 0;
        transition: opacity var(--transition-fast);
    }

    .save-indicator.visible {
        opacity: 1;
    }

    /* ─── Day navigation (mobile) ───────────────────────── */
    .day-nav {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .day-tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        flex: 1;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
    }

    .day-tabs::-webkit-scrollbar {
        display: none;
    }

    .day-tab {
        padding: 0.375rem 0.625rem;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-full);
        background: transparent;
        color: var(--fg-muted);
        font-size: 0.75rem;
        font-family: inherit;
        white-space: nowrap;
        cursor: pointer;
        transition: all var(--transition-fast);
        position: relative;
    }

    .day-tab.active {
        background-color: var(--interactive);
        color: var(--bg-primary);
        border-color: var(--interactive);
    }

    .day-tab.has-slots::after {
        content: "";
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background-color: var(--avail-yes);
    }

    .day-title {
        text-align: center;
        font-size: 1rem;
        margin-bottom: 0.75rem;
    }

    .day-actions {
        display: flex;
        gap: 0.25rem;
        margin-bottom: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
    }

    /* ─── Slot list (mobile) ────────────────────────────── */
    .slot-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .slot-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border: none;
        border-radius: var(--radius-sm);
        background-color: var(--bg-surface);
        color: var(--fg-primary);
        font-family: inherit;
        font-size: 0.9375rem;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 48px;
        width: 100%;
        text-align: left;
    }

    .slot-row:hover:not(.disabled) {
        background-color: var(--bg-hover);
    }

    .slot-row.available {
        background-color: var(--avail-yes-bg);
        border-left: 3px solid var(--avail-yes);
    }

    .slot-row.maybe {
        background-color: var(--avail-maybe-bg);
        border-left: 3px solid var(--avail-maybe);
    }

    .slot-row.disabled {
        cursor: default;
        opacity: 0.7;
    }

    .slot-time {
        font-weight: 500;
    }

    .slot-indicators {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .slot-count {
        font-size: 0.75rem;
        color: var(--fg-muted);
    }

    .slot-status-icon {
        width: 20px;
        text-align: center;
        font-weight: 600;
    }

    /* ─── Desktop grid ──────────────────────────────────── */
    .grid-container {
        margin: 0 -0.5rem;
    }

    .grid-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .availability-grid {
        width: 100%;
        border-collapse: separate;
        border-spacing: 2px;
    }

    .time-header {
        width: 80px;
    }

    .date-header {
        text-align: center;
        padding: 0.5rem;
        font-weight: 500;
        font-size: 0.8125rem;
    }

    .date-day {
        display: block;
        color: var(--fg-secondary);
    }

    .date-num {
        display: block;
        font-size: 0.75rem;
        color: var(--fg-muted);
    }

    .time-label {
        font-size: 0.75rem;
        color: var(--fg-muted);
        padding: 0.25rem 0.5rem;
        white-space: nowrap;
        vertical-align: middle;
    }

    .grid-cell {
        min-width: 60px;
        height: 32px;
        background-color: var(--bg-surface);
        border-radius: 4px;
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: center;
        vertical-align: middle;
        position: relative;
    }

    .grid-cell:hover:not(.disabled) {
        background-color: var(--bg-hover);
    }

    .grid-cell.available {
        background-color: var(--avail-yes);
        color: var(--bg-primary);
    }

    .grid-cell.maybe {
        background-color: var(--avail-maybe);
        color: var(--bg-primary);
    }

    .grid-cell.disabled {
        cursor: default;
        opacity: 0.5;
    }

    .cell-icon {
        font-size: 0.75rem;
        font-weight: 700;
    }

    .desktop-day-actions {
        display: flex;
        padding-left: 82px;
        gap: 2px;
        margin-top: 4px;
    }

    .day-action-col {
        flex: 1;
        display: flex;
        gap: 2px;
        justify-content: center;
    }

    /* ─── Heatmap ───────────────────────────────────────── */
    .heatmap-cell {
        background-color: color-mix(
            in srgb,
            var(--avail-yes) calc(var(--heat) * 100%),
            var(--bg-surface)
        );
        cursor: default;
    }

    .cell-count {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--fg-primary);
    }

    .heatmap-row {
        position: relative;
    }

    .heat-bar {
        height: 4px;
        background-color: var(--avail-yes);
        border-radius: 2px;
        transition: width var(--transition-fast);
    }

    /* ─── Best times ────────────────────────────────────── */
    .best-times {
        margin-bottom: 2rem;
    }

    .best-times h2 {
        margin-bottom: 0.75rem;
    }

    .best-times-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .best-time-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
    }

    .best-time-rank {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--fg-muted);
        min-width: 2rem;
    }

    .best-time-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .best-time-date {
        font-weight: 500;
        font-size: 0.9375rem;
    }

    .best-time-range {
        font-size: 0.8125rem;
        color: var(--fg-muted);
    }

    .best-time-count {
        font-weight: 600;
        color: var(--avail-yes);
        font-size: 1.125rem;
    }

    /* ─── Participant list ──────────────────────────────── */
    .participant-list {
        margin-top: 2rem;
    }

    .participant-list h3 {
        margin-bottom: 0.75rem;
    }

    .participant-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.625rem 1rem;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--fg-primary);
        font-family: inherit;
        font-size: 0.9375rem;
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .participant-row:hover {
        background-color: var(--bg-hover);
    }

    .participant-row.highlighted {
        background-color: var(--bg-surface);
        border-left: 3px solid var(--interactive);
    }

    .participant-name {
        font-weight: 500;
    }

    .participant-slots {
        font-size: 0.8125rem;
        color: var(--fg-muted);
    }

    /* ─── Tooltip ───────────────────────────────────────── */
    .tooltip {
        position: fixed;
        z-index: 1000;
        background-color: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.75rem;
        box-shadow: var(--shadow-md);
        max-width: 240px;
        pointer-events: none;
    }

    .tooltip-group {
        margin-bottom: 0.5rem;
    }

    .tooltip-group:last-child {
        margin-bottom: 0;
    }

    .tooltip-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--fg-muted);
        margin-bottom: 0.25rem;
    }

    .tooltip-name {
        display: block;
        font-size: 0.8125rem;
    }

    /* ─── States ────────────────────────────────────────── */
    .loading-state,
    .error-state,
    .empty-state {
        text-align: center;
        padding: 3rem 1rem;
    }

    .error-state h1 {
        margin-bottom: 0.5rem;
    }

    .error-state .btn {
        margin-top: 1.5rem;
    }

    .password-gate {
        max-width: 400px;
        margin: 3rem auto;
        text-align: center;
    }

    .password-gate form {
        margin-top: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .error-text {
        color: var(--accent-red);
        font-size: 0.875rem;
    }

    /* ─── Results section ───────────────────────────────── */
    .heatmap-section {
        margin-top: 1.5rem;
    }

    .heatmap-section h3 {
        margin-bottom: 1rem;
    }

    /* ─── Responsive ────────────────────────────────────── */
    @media (max-width: 640px) {
        .event-header h1 {
            font-size: 1.5rem;
        }

        .toolbar {
            flex-wrap: wrap;
            gap: 0.5rem;
        }
    }
</style>
