<script lang="ts">
    import { page } from "$app/stores";
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";

    let slug = $derived($page.params.slug);
    let adminToken = $state("");
    let eventUrl = $state("");
    let adminUrl = $state("");
    let copied = $state<"event" | "admin" | null>(null);

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        adminToken = params.get("admin") || "";
        const base = window.location.origin;
        eventUrl = `${base}/e/${slug}`;
        adminUrl = `${base}/e/${slug}?admin=${adminToken}`;
    });

    async function copyToClipboard(text: string, type: "event" | "admin") {
        try {
            await navigator.clipboard.writeText(text);
            copied = type;
            setTimeout(() => {
                copied = null;
            }, 2000);
        } catch {
            // Fallback: select the text
        }
    }

    // Simple QR code as SVG (using a data URL approach)
    // In production, use the qrcode library. For now, show a placeholder.
    let qrDataUrl = $state("");

    onMount(async () => {
        try {
            const QRCode = await import("qrcode");
            qrDataUrl = await QRCode.toDataURL(eventUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: "#1a1d21",
                    light: "#f0efeb",
                },
            });
        } catch {
            // QR code generation failed silently
        }
    });
</script>

<svelte:head>
    <title>Event Created — TrulyMeet</title>
</svelte:head>

<div class="container">
    <div class="created-page animate-fade-in">
        <div class="success-icon">✓</div>
        <h1>{t("event.created.title")}</h1>

        <!-- Event link -->
        <div class="link-group card">
            <label class="label">{t("event.created.shareLinkLabel")}</label>
            <div class="link-row">
                <input
                    class="input link-input"
                    type="text"
                    value={eventUrl}
                    readonly
                    onclick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                    class="btn btn-primary"
                    onclick={() => copyToClipboard(eventUrl, "event")}
                >
                    {copied === "event"
                        ? t("event.created.copied")
                        : t("event.created.copyLink")}
                </button>
            </div>
        </div>

        <!-- Admin link -->
        <div class="link-group card admin-card">
            <label class="label">{t("event.created.adminLinkLabel")}</label>
            <div class="link-row">
                <input
                    class="input link-input"
                    type="text"
                    value={adminUrl}
                    readonly
                    onclick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                    class="btn btn-secondary"
                    onclick={() => copyToClipboard(adminUrl, "admin")}
                >
                    {copied === "admin"
                        ? t("event.created.copied")
                        : t("event.created.copyLink")}
                </button>
            </div>
            <p class="admin-warning">⚠️ {t("event.created.adminWarning")}</p>
        </div>

        <!-- QR Code -->
        {#if qrDataUrl}
            <div class="qr-section">
                <img
                    src={qrDataUrl}
                    alt={t("event.created.qrCodeAlt")}
                    class="qr-code"
                />
            </div>
        {/if}

        <!-- Create another -->
        <a href="/" class="btn btn-ghost create-another">
            {t("event.created.createAnother")}
        </a>
    </div>
</div>

<style>
    .created-page {
        max-width: 520px;
        margin: 0 auto;
        text-align: center;
        padding: 2rem 0;
    }

    .success-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background-color: var(--avail-yes-bg);
        color: var(--avail-yes);
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }

    h1 {
        margin-bottom: 2rem;
    }

    .link-group {
        margin-bottom: 1rem;
        text-align: left;
    }

    .link-row {
        display: flex;
        gap: 0.5rem;
    }

    .link-input {
        flex: 1;
        font-size: 0.8125rem;
        font-family: monospace;
    }

    .admin-card {
        border-color: var(--accent-yellow);
    }

    .admin-warning {
        margin-top: 0.75rem;
        font-size: 0.8125rem;
        color: var(--accent-yellow);
        line-height: 1.5;
    }

    .qr-section {
        margin: 2rem 0;
    }

    .qr-code {
        width: 200px;
        height: 200px;
        border-radius: var(--radius-md);
    }

    .create-another {
        margin-top: 1rem;
    }
</style>
