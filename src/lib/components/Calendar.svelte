<script lang="ts">
    /**
     * Interactive multi-date calendar picker.
     * Tap dates to toggle selection. Supports month navigation.
     * Mobile-first with large touch targets.
     */

    let {
        selectedDates = $bindable<string[]>([]),
    }: {
        selectedDates: string[];
    } = $props();

    let viewYear = $state(new Date().getFullYear());
    let viewMonth = $state(new Date().getMonth()); // 0-indexed

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    function getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year: number, month: number): number {
        return new Date(year, month, 1).getDay();
    }

    function formatDate(year: number, month: number, day: number): string {
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function isSelected(dateStr: string): boolean {
        return selectedDates.includes(dateStr);
    }

    function isPast(dateStr: string): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dateStr + "T00:00:00") < today;
    }

    function toggleDate(dateStr: string): void {
        if (isPast(dateStr)) return;

        if (selectedDates.includes(dateStr)) {
            selectedDates = selectedDates.filter((d) => d !== dateStr);
        } else {
            selectedDates = [...selectedDates, dateStr].sort();
        }
    }

    function prevMonth(): void {
        if (viewMonth === 0) {
            viewMonth = 11;
            viewYear--;
        } else {
            viewMonth--;
        }
    }

    function nextMonth(): void {
        if (viewMonth === 11) {
            viewMonth = 0;
            viewYear++;
        } else {
            viewMonth++;
        }
    }

    function isToday(dateStr: string): boolean {
        const today = new Date();
        return (
            formatDate(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
            ) === dateStr
        );
    }

    // Generate calendar grid
    let calendarDays = $derived.by(() => {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
        const days: (number | null)[] = [];

        // Padding for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d);
        }

        return days;
    });
</script>

<div class="calendar" role="group" aria-label="Date picker">
    <!-- Month navigation -->
    <div class="calendar-nav">
        <button
            class="btn btn-ghost btn-icon"
            onclick={prevMonth}
            aria-label="Previous month"
        >
            ←
        </button>
        <span class="calendar-title">
            {MONTHS[viewMonth]}
            {viewYear}
        </span>
        <button
            class="btn btn-ghost btn-icon"
            onclick={nextMonth}
            aria-label="Next month"
        >
            →
        </button>
    </div>

    <!-- Day headers -->
    <div class="calendar-grid">
        {#each DAYS as day}
            <div class="calendar-day-header" aria-hidden="true">{day}</div>
        {/each}

        <!-- Day cells -->
        {#each calendarDays as day}
            {#if day === null}
                <div class="calendar-cell empty"></div>
            {:else}
                {@const dateStr = formatDate(viewYear, viewMonth, day)}
                {@const past = isPast(dateStr)}
                {@const selected = isSelected(dateStr)}
                {@const today = isToday(dateStr)}
                <button
                    type="button"
                    class="calendar-cell"
                    class:selected
                    class:past
                    class:today
                    disabled={past}
                    aria-label="{MONTHS[viewMonth]} {day}, {viewYear}{selected
                        ? ', selected'
                        : ''}"
                    aria-pressed={selected}
                    onclick={() => toggleDate(dateStr)}
                >
                    {day}
                </button>
            {/if}
        {/each}
    </div>

    <!-- Selected count -->
    {#if selectedDates.length > 0}
        <p class="calendar-count">
            {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
        </p>
    {/if}
</div>

<style>
    .calendar {
        width: 100%;
    }

    .calendar-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
    }

    .calendar-title {
        font-weight: 600;
        font-size: 1rem;
        color: var(--fg-primary);
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
    }

    .calendar-day-header {
        text-align: center;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--fg-muted);
        padding: 0.25rem 0;
    }

    .calendar-cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--fg-primary);
        font-size: 0.875rem;
        font-family: inherit;
        cursor: pointer;
        transition: all var(--transition-fast);
        min-height: 44px;
        position: relative;
    }

    .calendar-cell:not(.empty):not(.past):hover {
        background-color: var(--bg-hover);
    }

    .calendar-cell.selected {
        background-color: var(--interactive);
        color: var(--bg-primary);
        font-weight: 600;
    }

    .calendar-cell.selected:hover {
        opacity: 0.9;
    }

    .calendar-cell.past {
        color: var(--fg-muted);
        opacity: 0.4;
        cursor: not-allowed;
    }

    .calendar-cell.today:not(.selected) {
        border: 2px solid var(--border-default);
    }

    .calendar-cell.empty {
        cursor: default;
    }

    .calendar-count {
        margin-top: 0.75rem;
        font-size: 0.8125rem;
        color: var(--fg-muted);
        text-align: center;
    }

    @media (max-width: 640px) {
        .calendar-cell {
            min-height: 48px;
            font-size: 0.9375rem;
        }
    }
</style>
