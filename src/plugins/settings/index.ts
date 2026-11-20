import { chunkMarker } from "@shared/chunkPatches";
import { MOD_NAME } from "@shared/constants";
import { definePlugin } from "@shared/plugin";
import { SETTINGS_TABS } from "@shared/settingsTabs";

const routes = SETTINGS_TABS.map(({ id, route }) => `{path:"${route}",lazy:()=>globalThis.Mepluh.loadSettingsRoute("${id}")},`).join("");

const sidebarLinks = (jsx: string, link: string): string =>
    SETTINGS_TABS.map(({ label, route }) => `(0,${jsx}.jsx)(${link},{to:"/settings/${route}",children:"${label}"})`).join(",");

const SETTINGS_ICON_DOT_ATTR = "data-mepluh-settings-dot";
const MEPLUH_TAB_BADGE_ATTR = "data-mepluh-tab-badge";
const UPDATE_BADGE_STYLE_ID = "mepluh-update-badge-style";

let badgeObserver: MutationObserver | undefined;
let unsubscribeUpdate: (() => void) | undefined;
let isSyncingBadges = false;

const injectBadgeStyle = (): void => {
    const root = document.head ?? document.documentElement;
    if (!root || document.getElementById(UPDATE_BADGE_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = UPDATE_BADGE_STYLE_ID;
    style.textContent = `
        [${SETTINGS_ICON_DOT_ATTR}="true"] {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 8px;
            height: 8px;
            border-radius: 9999px;
            background: #f97316;
            box-shadow: 0 0 0 2px rgba(15, 15, 18, 0.9);
            pointer-events: none;
        }
        [${MEPLUH_TAB_BADGE_ATTR}="true"] {
            margin-left: auto;
            padding: 1px 6px;
            border-radius: 9999px;
            background: rgba(249, 115, 22, 0.18);
            border: 1px solid rgba(249, 115, 22, 0.5);
            color: #fb923c;
            font-size: 10px;
            font-weight: 700;
            line-height: 14px;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            pointer-events: none;
        }
    `;
    root.appendChild(style);
};

const removeBadgeElements = (): void => {
    document.querySelectorAll(`[${SETTINGS_ICON_DOT_ATTR}="true"]`).forEach(el => el.remove());
    document.querySelectorAll(`[${MEPLUH_TAB_BADGE_ATTR}="true"]`).forEach(el => el.remove());
};

const syncUpdateBadges = (available: boolean): void => {
    if (isSyncingBadges) return;
    isSyncingBadges = true;
    try {
        if (!available) {
            removeBadgeElements();
            return;
        }

        injectBadgeStyle();

        // 1. Settings gear icon badge (matches both active "settings-filled" and inactive "settings")
        const settingsIcons = document.querySelectorAll<HTMLElement>(
            '[data-slot="standard-icon"][data-shape="settings-filled"], [data-slot="standard-icon"][data-shape="settings"]'
        );
        for (const icon of settingsIcons) {
            // Skip the large icon inside the OverviewTab header
            if (icon.closest('[data-slot="tab-page"]')) continue;
            const wrapper = icon.closest<HTMLElement>("div.grid, button, a") ?? icon.parentElement;
            if (!wrapper) continue;
            if (wrapper.style.position !== "relative" && getComputedStyle(wrapper).position === "static") {
                wrapper.style.position = "relative";
            }
            if (!wrapper.querySelector(`[${SETTINGS_ICON_DOT_ATTR}="true"]`)) {
                const dot = document.createElement("span");
                dot.setAttribute(SETTINGS_ICON_DOT_ATTR, "true");
                wrapper.appendChild(dot);
            }
        }

        // 2. "Update" pill badge on the Mepluh item in the Settings sidebar
        const sidebarCandidates = document.querySelectorAll<HTMLElement>('a[href*="/settings/mepluh"], div.cursor-pointer');
        for (const el of sidebarCandidates) {
            const isMepluhItem =
                el.getAttribute("href")?.endsWith("/settings/mepluh") ||
                Array.from(el.childNodes).some(
                    node => node.nodeType === Node.TEXT_NODE && (node.nodeValue ?? "").trim() === MOD_NAME
                );
            if (!isMepluhItem) continue;
            if (!el.querySelector(`[${MEPLUH_TAB_BADGE_ATTR}="true"]`)) {
                const badge = document.createElement("span");
                badge.setAttribute(MEPLUH_TAB_BADGE_ATTR, "true");
                badge.textContent = "Update";
                el.appendChild(badge);
            }
        }
    } finally {
        isSyncingBadges = false;
    }
};

export default definePlugin({
    name: "Settings",
    description: `Adds the ${MOD_NAME} section to Medal's settings, rendered with Medal's own components.`,
    category: "Core",
    enabledByDefault: true,
    required: true,
    patches: [
        {
            find: '{path:"pc-storage",',
            replacement: { match: '{path:"pc-storage",', replace: `${routes}{path:"pc-storage",` }
        },
        {
            find: chunkMarker("renderer-SettingsLayout"),
            replacement: {
                match: /\(0,(\i)\.jsxs\)\((\i),\{children:\[\(0,\i\.jsx\)\((\i),\{children:\(0,\i\.jsx\)\(\i,\{id:"recording",[^]*?\(0,\i\.jsx\)\((\i),\{to:"\/settings\/capture-hotkeys"/,
                replace: `(0,$1.jsxs)($2,{children:[(0,$1.jsx)($3,{children:"${MOD_NAME}"}),${sidebarLinks("$1", "$4")}]}),$&`
            }
        }
    ],
    start() {
        let updateAvailable = false;
        try {
            updateAvailable = MepluhNative.isUpdateAvailable();
        } catch {}

        unsubscribeUpdate = MepluhNative.onUpdateAvailableChanged(available => {
            updateAvailable = available;
            syncUpdateBadges(updateAvailable);
        });

        badgeObserver = new MutationObserver(() => {
            if (updateAvailable) syncUpdateBadges(true);
        });
        badgeObserver.observe(document, { childList: true, subtree: true });
        if (document.documentElement) syncUpdateBadges(updateAvailable);
    },
    stop() {
        badgeObserver?.disconnect();
        badgeObserver = undefined;
        unsubscribeUpdate?.();
        unsubscribeUpdate = undefined;
        removeBadgeElements();
        document.getElementById(UPDATE_BADGE_STYLE_ID)?.remove();
    }
});