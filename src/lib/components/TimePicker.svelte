<script lang="ts">
    /**
     * Time picker using native select elements for mobile friendliness.
     * Generates time options at 30-minute intervals.
     */

    let {
        value = $bindable("09:00"),
        label = "",
        id = "",
    }: {
        value: string;
        label?: string;
        id?: string;
    } = $props();

    // Generate time options from 00:00 to 23:30
    const timeOptions: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const ampm = h < 12 ? "AM" : "PM";
            const lbl = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
            timeOptions.push({ value: val, label: lbl });
        }
    }
</script>

<div class="time-picker">
    {#if label}
        <label class="label" for={id}>{label}</label>
    {/if}
    <select class="input" {id} bind:value aria-label={label || "Select time"}>
        {#each timeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
        {/each}
    </select>
</div>

<style>
    .time-picker {
        display: flex;
        flex-direction: column;
    }
</style>
