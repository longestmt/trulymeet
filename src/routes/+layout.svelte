<script lang="ts">
	import { onMount } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
	import "../app.css";

	let { children } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

<svelte:head>
	<meta
		name="description"
		content="TrulyMeet — Free, open-source group scheduling. Find a time. No accounts. No tracking."
	/>
	<meta property="og:site_name" content="TrulyMeet" />
	<meta name="theme-color" content="#1a1d21" />
</svelte:head>

<div class="app-shell">
	<header class="app-header">
		<div class="header-inner container">
			<a href="/" class="logo" aria-label="TrulyMeet home">
				<span class="logo-mark">⊕</span>
				<span class="logo-text">TrulyMeet</span>
			</a>
			<ThemeSwitcher />
		</div>
	</header>

	<main class="app-main">
		{@render children()}
	</main>

	<footer class="app-footer">
		<div class="container">
			<p class="footer-text">
				Free & open-source ·
				<a
					href="https://github.com/longestmt/trulymeet"
					target="_blank"
					rel="noopener">Source code</a
				>
				·
				<a
					href="https://ko-fi.com/longestmt"
					target="_blank"
					rel="noopener">Ko-fi</a
				>
				· AGPL-3.0
			</p>
		</div>
	</footer>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.app-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background-color: var(--bg-primary);
		border-bottom: 1px solid var(--border-subtle);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--fg-primary);
	}

	.logo:hover {
		color: var(--fg-primary);
	}

	.logo-mark {
		font-size: 1.5rem;
		line-height: 1;
	}

	.logo-text {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.app-main {
		flex: 1;
		padding: 2rem 0;
	}

	.app-footer {
		padding: 1.5rem 0;
		border-top: 1px solid var(--border-subtle);
	}

	.footer-text {
		font-size: 0.8125rem;
		color: var(--fg-muted);
		text-align: center;
	}

	.footer-text a {
		color: var(--fg-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.footer-text a:hover {
		color: var(--fg-secondary);
	}

	@media (max-width: 640px) {
		.app-main {
			padding: 1.25rem 0;
		}

		.header-inner {
			height: 48px;
		}

		.logo-text {
			font-size: 1rem;
		}
	}
</style>
