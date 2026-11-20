import { MOD_NAME } from "@shared/constants";
import type { ChangelogCommit, PendingChangelog } from "@shared/ipc";
import { whenDomReady } from "./domReady";

const MODAL_ID = "mepluh-changelog-modal";

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const formatDate = (iso: string): string => {
    if (!iso) return "";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const renderFeaturedEntry = (commit: ChangelogCommit): string => {
    const dateStr = formatDate(commit.date);
    return `
        <div class="flex flex-col gap-2 rounded-xl border border-brand-primary-700 bg-brand-primary-950 p-5">
            <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center rounded-md bg-brand-primary-500/20 px-2 py-0.5 text-xs font-semibold text-brand-primary-400">Latest</span>
                ${dateStr ? `<span class="text-xs text-foreground-500">${escapeHtml(dateStr)}</span>` : ""}
            </div>
            <span class="text-lg font-bold leading-snug text-foreground-0">${escapeHtml(commit.title)}</span>
            ${commit.body ? `<span class="whitespace-pre-line text-sm leading-relaxed text-foreground-300">${escapeHtml(commit.body)}</span>` : ""}
        </div>
    `;
};

const renderPastEntry = (commit: ChangelogCommit): string => {
    const dateStr = formatDate(commit.date);
    return `
        <div class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
                <span class="text-sm font-medium text-foreground-0">${escapeHtml(commit.title)}</span>
                ${dateStr ? `<span class="shrink-0 text-xs text-foreground-500">${escapeHtml(dateStr)}</span>` : ""}
            </div>
            ${commit.body ? `<span class="whitespace-pre-line text-xs leading-relaxed text-foreground-300">${escapeHtml(commit.body)}</span>` : ""}
        </div>
    `;
};

const mountChangelogDialog = (changelog: PendingChangelog): void => {
    if (document.getElementById(MODAL_ID)) return;
    const latest = changelog.commits[0];
    if (!latest) return;

    const past = changelog.commits.slice(1);
    const pastHtml =
        past.length > 0
            ? `
                <div class="flex flex-col gap-2">
                    <span class="text-xs font-semibold uppercase tracking-wider text-foreground-500">Previous Updates</span>
                    <div class="flex flex-col divide-y divide-stroke-0/16 rounded-lg bg-third-layer px-5 py-4">
                        ${past.map(renderPastEntry).join("")}
                    </div>
                </div>
            `
            : "";

    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-xs";
    overlay.style.zIndex = "2147483646";
    overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-label="What's New in ${MOD_NAME}" class="relative flex w-full max-w-[600px] flex-col gap-5 rounded-xl border border-stroke-0/16 bg-second-layer p-6 text-foreground-0 shadow-2xl">
            <button type="button" data-mepluh-close aria-label="Close" class="absolute top-4 right-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-foreground-400 transition-colors hover:bg-third-layer hover:text-foreground-0">
                ✕
            </button>

            <div class="flex flex-col gap-1.5 pe-8">
                <div class="flex items-center gap-2">
                    <h2 class="m-0 text-xl font-bold text-foreground-0">What's New in ${MOD_NAME}</h2>
                    <span class="inline-flex items-center rounded-md bg-brand-primary-500/20 px-2 py-0.5 text-xs font-semibold text-brand-primary-400">v${escapeHtml(MEPLUH_VERSION)}</span>
                </div>
                <p class="m-0 text-sm text-foreground-300">Patch notes from your updates.</p>
            </div>

            <div class="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
                ${renderFeaturedEntry(latest)}
                ${pastHtml}
            </div>

            <div class="flex items-center justify-end pt-1">
                <button type="button" data-mepluh-done class="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-brand-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Done
                </button>
            </div>
        </div>
    `;

    const close = (): void => {
        window.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        void MepluhNative.dismissPendingChangelog();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
        }
    };

    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    overlay.querySelector("[data-mepluh-close]")?.addEventListener("click", close);
    overlay.querySelector("[data-mepluh-done]")?.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown, true);

    (document.body ?? document.documentElement).appendChild(overlay);
};

export const checkAndShowPendingChangelog = async (): Promise<void> => {
    const changelog = await MepluhNative.getPendingChangelog();
    if (!changelog || changelog.commits.length === 0) return;
    await whenDomReady();
    window.setTimeout(() => mountChangelogDialog(changelog), 1000);
};