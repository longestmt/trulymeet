<script lang="ts">
	import { themeStore, type Theme } from '$lib/stores/theme.svelte';

	const themes: { value: Theme; label: string; icon: string }[] = [
		{ value: 'compline', label: 'Dark', icon: '🌙' },
		{ value: 'lauds', label: 'Light', icon: '☀️' },
		{ value: 'vigil', label: 'AMOLED', icon: '⬛' }
	];
</script>

<div class="theme-switcher" role="radiogroup" aria-label="Color theme">
	{#each themes as theme}
		<button
			class="theme-option"
			class:active={themeStore.current === theme.value}
			role="radio"
			aria-checked={themeStore.current === theme.value}
			aria-label="{theme.label} theme"
			title="{theme.label} theme"
			onclick={() => themeStore.set(theme.value)}
		>
			<span class="theme-icon">{theme.icon}</span>
		</button>
	{/each}
</div>

<style>
	.theme-switcher {
		display: flex;
		gap: 2px;
		background-color: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		padding: 3px;
	}

	.theme-option {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		cursor: pointer;
		transition: all var(--transition-fast);
		font-size: 0.875rem;
	}

	.theme-option:hover {
		background-color: var(--bg-hover);
	}

	.theme-option.active {
		background-color: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
	}

	.theme-icon {
		line-height: 1;
	}
</style>
