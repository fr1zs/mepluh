import { MOD_NAME } from "@shared/constants";
import type { ChangelogCommit, PendingChangelog } from "@shared/ipc";
import { whenDomReady } from "./domReady";

const MODAL_ID = "mepluh-changelog-modal";
const STYLE_ID = "mepluh-changelog-style";

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

const injectStyle = (): void => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        #${MODAL_ID} {
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(8, 8, 11, 0.78);
            backdrop-filter: blur(8px);
            animation: mepluh-cl-fade 0.18s ease-out;
            font-family: inherit;
        }
        @keyframes mepluh-cl-fade {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes mepluh-cl-pop {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mepluh-cl-card {
            width: 100%;
            max-width: 560px;
            max-height: 82vh;
            display: flex;
            flex-direction: column;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #121216;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
            color: #f4f4f5;
            overflow: hidden;
            animation: mepluh-cl-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mepluh-cl-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 20px 22px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: linear-gradient(180deg, rgba(237, 28, 36, 0.14) 0%, rgba(18, 18, 22, 0) 100%);
        }
        .mepluh-cl-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .mepluh-cl-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
        }
        .mepluh-cl-pill {
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            background: rgba(237, 28, 36, 0.18);
            border: 1px solid rgba(237, 28, 36, 0.45);
            color: #ff5c62;
        }
        .mepluh-cl-subtitle {
            margin: 5px 0 0;
            font-size: 13px;
            color: #a1a1aa;
        }
        .mepluh-cl-close {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.04);
            color: #a1a1aa;
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, color 0.15s ease;
        }
        .mepluh-cl-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }
        .mepluh-cl-list {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .mepluh-cl-featured {
            padding: 16px 18px;
            border-radius: 12px;
            border: 1px solid rgba(237, 28, 36, 0.48);
            background: linear-gradient(135deg, rgba(237, 28, 36, 0.16) 0%, rgba(255, 255, 255, 0.03) 100%);
            box-shadow: 0 8px 24px rgba(237, 28, 36, 0.12);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .mepluh-cl-featured-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .mepluh-cl-latest-badge {
            padding: 2px 8px;
            border-radius: 6px;
            background: #ED1C24;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .mepluh-cl-featured-title {
            font-size: 16.5px;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.38;
        }
        .mepluh-cl-featured-body {
            font-size: 13.5px;
            color: #d4d4d8;
            line-height: 1.5;
            white-space: pre-line;
        }
        .mepluh-cl-section-label {
            margin: 6px 0 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #71717a;
        }
        .mepluh-cl-item {
            padding: 10px 13px;
            border-radius: 9px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.025);
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .mepluh-cl-item-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
        }
        .mepluh-cl-item-title {
            font-size: 12.5px;
            font-weight: 500;
            color: #d4d4d8;
            line-height: 1.4;
        }
        .mepluh-cl-item-meta {
            flex-shrink: 0;
            font-size: 10.5px;
            font-family: Consolas, monospace;
            color: #71717a;
            padding-top: 2px;
        }
        .mepluh-cl-item-body {
            margin: 2px 0 0;
            font-size: 12px;
            color: #8e8e98;
            line-height: 1.42;
            white-space: pre-line;
        }
        .mepluh-cl-footer {
            padding: 14px 22px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: flex-end;
            background: rgba(0, 0, 0, 0.2);
        }
        .mepluh-cl-btn {
            padding: 8px 18px;
            border-radius: 8px;
            border: 1px solid rgba(237, 28, 36, 0.6);
            background: #ED1C24;
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: filter 0.15s ease, transform 0.1s ease;
        }
        .mepluh-cl-btn:hover {
            filter: brightness(1.1);
        }
        .mepluh-cl-btn:active {
            transform: scale(0.98);
        }
    `;
    (document.head ?? document.documentElement).appendChild(style);
};

const renderFeaturedCommit = (commit: ChangelogCommit): string => {
    const dateStr = formatDate(commit.date);
    const meta = [commit.sha, dateStr].filter(Boolean).join(" · ");
    const bodyHtml = commit.body ? `<div class="mepluh-cl-featured-body">${escapeHtml(commit.body)}</div>` : "";
    return `
        <div class="mepluh-cl-featured">
            <div class="mepluh-cl-featured-top">
                <span class="mepluh-cl-latest-badge">Latest</span>
                ${meta ? `<span class="mepluh-cl-item-meta">${escapeHtml(meta)}</span>` : ""}
            </div>
            <div class="mepluh-cl-featured-title">${escapeHtml(commit.title)}</div>
            ${bodyHtml}
        </div>
    `;
};

const renderPastCommit = (commit: ChangelogCommit): string => {
    const dateStr = formatDate(commit.date);
    const meta = [commit.sha, dateStr].filter(Boolean).join(" · ");
    const bodyHtml = commit.body ? `<div class="mepluh-cl-item-body">${escapeHtml(commit.body)}</div>` : "";
    return `
        <div class="mepluh-cl-item">
            <div class="mepluh-cl-item-top">
                <span class="mepluh-cl-item-title">${escapeHtml(commit.title)}</span>
                ${meta ? `<span class="mepluh-cl-item-meta">${escapeHtml(meta)}</span>` : ""}
            </div>
            ${bodyHtml}
        </div>
    `;
};

const showChangelogModal = (changelog: PendingChangelog): void => {
    if (document.getElementById(MODAL_ID)) return;
    const latest = changelog.commits[0];
    if (!latest) return;

    injectStyle();

    const rangeLabel = changelog.fromSha
        ? `${changelog.fromSha} → ${changelog.toSha}`
        : `Updated to ${changelog.toSha}`;

    const pastCommits = changelog.commits.slice(1);
    const pastSectionHtml =
        pastCommits.length > 0
            ? `<div class="mepluh-cl-section-label">Past Commits (${pastCommits.length})</div>${pastCommits.map(renderPastCommit).join("")}`
            : "";

    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.innerHTML = `
        <div class="mepluh-cl-card" role="dialog" aria-modal="true" aria-label="${MOD_NAME} Changelog">
            <div class="mepluh-cl-header">
                <div>
                    <div class="mepluh-cl-title-row">
                        <h2 class="mepluh-cl-title">${MOD_NAME} Changelog</h2>
                        <span class="mepluh-cl-pill">${escapeHtml(rangeLabel)}</span>
                    </div>
                    <p class="mepluh-cl-subtitle">Full commit history (${changelog.commits.length} total)</p>
                </div>
                <button type="button" class="mepluh-cl-close" aria-label="Close">✕</button>
            </div>
            <div class="mepluh-cl-list">
                ${renderFeaturedCommit(latest)}
                ${pastSectionHtml}
            </div>
            <div class="mepluh-cl-footer">
                <button type="button" class="mepluh-cl-btn">Got it</button>
            </div>
        </div>
    `;

    const close = (): void => {
        window.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        document.getElementById(STYLE_ID)?.remove();
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
    overlay.querySelector(".mepluh-cl-close")?.addEventListener("click", close);
    overlay.querySelector(".mepluh-cl-btn")?.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown, true);

    (document.body ?? document.documentElement).appendChild(overlay);
};

export const checkAndShowPendingChangelog = async (): Promise<void> => {
    const changelog = await MepluhNative.consumeChangelog();
    if (!changelog) return;
    await whenDomReady();
    window.setTimeout(() => showChangelogModal(changelog), 800);
};