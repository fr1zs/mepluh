import { definePlugin } from "@shared/plugin";

const STYLES = `
/* Hide Home, Games, Events and Premium from the left icon bar */
[aria-disabled]:has(> .icon-container [data-shape="home-filled"]),
[aria-disabled]:has(> .icon-container [data-shape="game-filled"]),
[aria-disabled]:has(> .icon-container [data-shape="quests-filled"]),
[aria-disabled]:has(> .icon-container [data-shape="medal-premium"]) {
    display: none !important;
}

/* Make the Medal logo untappable */
[data-testid="medal-logo-button"] {
    pointer-events: none !important;
    cursor: default !important;
}

/* Hide the "Back up now" button */
button:has(> [data-shape="clip-sync-back-up"]) {
    display: none !important;
}

/* Hide the whole "More" section in My Clips (Liked, Saved, Clips You Are In, Sent by friends, Watch History) */
[data-slot="sidebar-group"]:has(a[href="/library/liked"], a[href="/library/watch-history"]) {
    display: none !important;
}

/* Hide the search, chat and notifications icons at the top */
div[aria-disabled]:has(> [data-shape="search"]),
div[aria-disabled]:has(> [data-shape="chat-and-comments"]),
div:has(> [data-testid="notification-bell-button"]) {
    display: none !important;
}

/* Remove the empty ad placeholder from the clip grid */
[data-library-item="true"]:has(> div:only-child:empty):not(:has([data-own-border], .preview)) {
    display: none !important;
}
`;

export default definePlugin({
    name: "HideOnlineFeatures",
    description:
        "Hides Home, Games, Events and Premium, the search/chat/notification icons, and the More section in the Library.",
    category: "Appearance",
    enabledByDefault: true,
    styles: STYLES
});
