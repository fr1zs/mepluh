import { definePlugin } from "@shared/plugin";

const USER_INTENT_MS = 350;
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

let keyHandler: ((event: KeyboardEvent) => void) | undefined;
let focusHandler: ((event: FocusEvent) => void) | undefined;
let intentHandler: ((event: Event) => void) | undefined;
let blurPollTimer: number | undefined;

const isCaptionOrDescriptionBox = (el: HTMLElement): boolean => {
    if (el.id === "caption-input" || el.id === "description-input") return true;
    if (!(el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type)))) {
        return false;
    }
    const hint = `${el.id} ${el.name} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    return hint.includes("caption") || hint.includes("description") || hint.includes("title");
};

// A text field only counts as "typing" once it has content, because Medal auto-focuses an empty caption/description box.
const isTyping = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return (target.textContent ?? "").length > 0;
    if (target instanceof HTMLTextAreaElement) return target.value.length > 0;
    if (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)) return target.value.length > 0;
    return false;
};

const isEmptyTextField = (target: EventTarget | null): target is HTMLElement => {
    if (target instanceof HTMLTextAreaElement) return target.value.length === 0;
    return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type) && target.value.length === 0;
};

const visibleArea = (video: HTMLVideoElement): number => {
    const rect = video.getBoundingClientRect();
    return rect.width * rect.height;
};

// Prefer the video that is actually playing, otherwise the largest visible one.
const findVideo = (): HTMLVideoElement | undefined => {
    const videos = Array.from(document.querySelectorAll("video")).filter(video => video.readyState > 0 && visibleArea(video) > 0);
    return videos.find(video => !video.paused) ?? videos.sort((a, b) => visibleArea(b) - visibleArea(a))[0];
};

const HINT_PHRASE = "to navigate between clips";
const MAX_TRACKED_HINTS = 20;
const MAX_REWRITE_LOGS = 3;
// The footer hint is one short line of visible text. Never touch code, styles or editable text, or long blocks.
const SKIP_PARENT_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "TEMPLATE"]);
const MAX_HINT_NODE_LENGTH = 200;
const BUILD_MARKER = "footer-hint-v5";

let rewriteLogs = 0;

let hintObserver: MutationObserver | undefined;
// Remembers each rewritten text node's original text so it can be put back when the plugin is turned off.
const originalHints = new Map<Text, string>();

const rewriteHintText = (node: Text, replacement: string): void => {
    const value = node.nodeValue;
    if (!value || value.length > MAX_HINT_NODE_LENGTH || !value.includes(HINT_PHRASE)) return;
    if (node.parentElement && SKIP_PARENT_TAGS.has(node.parentElement.tagName)) return;
    if (originalHints.size > MAX_TRACKED_HINTS) {
        for (const tracked of originalHints.keys()) if (!tracked.isConnected) originalHints.delete(tracked);
    }
    originalHints.set(node, value);
    node.nodeValue = value.replace(HINT_PHRASE, replacement);
    if (rewriteLogs++ < MAX_REWRITE_LOGS) console.info(`[ArrowSeek] rewrote the footer hint -> "${node.nodeValue}"`);
};

const rewriteHintsWithin = (root: Node, replacement: string): void => {
    if (root.nodeType === Node.TEXT_NODE) return rewriteHintText(root as Text, replacement);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) rewriteHintText(node as Text, replacement);
};

const restoreHints = (): void => {
    hintObserver?.disconnect();
    hintObserver = undefined;
    for (const [node, original] of originalHints) if (node.isConnected) node.nodeValue = original;
    originalHints.clear();
    rewriteLogs = 0;
};

export default definePlugin({
    name: "ArrowSeek",
    description: "Left/Right arrow keys skip 5 seconds in the current clip instead of jumping to the previous/next clip.",
    category: "Experimental",
    enabledByDefault: true,
    options: {
        seconds: {
            type: "string",
            label: "Skip length (seconds)",
            description: "How far the arrow keys seek",
            default: "5"
        }
    },
    start({ options }) {
        const parsed = Number.parseFloat(options.seconds);
        const step = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
        let lastUserIntent = 0;
        let clickedTarget: EventTarget | null = null;

        // Track direct clicks onto the input itself or Tab key presses so clip clicks don't bypass unfocusing.
        intentHandler = event => {
            if (event.type === "keydown") {
                if ((event as KeyboardEvent).key !== "Tab") return;
                clickedTarget = null;
                lastUserIntent = Date.now();
                return;
            }
            clickedTarget = event.target;
            lastUserIntent = Date.now();
        };

        const shouldAllowFocus = (target: HTMLElement): boolean => {
            if (Date.now() - lastUserIntent >= USER_INTENT_MS) return false;
            // Allow if Tab was pressed (clickedTarget === null) or the user actually clicked inside this box
            return clickedTarget === null || (clickedTarget instanceof Node && target.contains(clickedTarget));
        };

        const blurIfAutofocused = (target: Element | null): void => {
            if (!(target instanceof HTMLElement) || !isCaptionOrDescriptionBox(target)) return;
            if (shouldAllowFocus(target)) return;
            target.blur();
            target.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
            target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
            // Medal sometimes re-applies focus on the next animation frame
            requestAnimationFrame(() => {
                if (document.activeElement === target && !shouldAllowFocus(target)) {
                    target.blur();
                    target.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
                    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
                }
            });
        };

        focusHandler = event => {
            const target = event.target instanceof Element ? event.target : null;
            if (target instanceof HTMLElement && isCaptionOrDescriptionBox(target) && !shouldAllowFocus(target)) {
                event.stopImmediatePropagation();
            }
            blurIfAutofocused(target);
        };

        keyHandler = event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (isTyping(event.target)) return;

            const video = findVideo();
            if (!video) return;

            // Capture phase on window runs before Medal's own listeners; stop them so the clip doesn't change.
            event.preventDefault();
            event.stopImmediatePropagation();

            if (isEmptyTextField(event.target)) event.target.blur();

            const delta = event.key === "ArrowRight" ? step : -step;
            const max = Number.isFinite(video.duration) ? video.duration : Infinity;
            video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), max);
        };

        window.addEventListener("pointerdown", intentHandler, true);
        window.addEventListener("keydown", intentHandler, true);
        window.addEventListener("focusin", focusHandler, true);
        window.addEventListener("keydown", keyHandler, true);

        // Unfocus immediately if Medal already focused the box before this plugin started
        blurIfAutofocused(document.activeElement);
        blurPollTimer = window.setInterval(() => blurIfAutofocused(document.activeElement), 250);
        window.setTimeout(() => {
            if (blurPollTimer !== undefined) {
                window.clearInterval(blurPollTimer);
                blurPollTimer = undefined;
            }
        }, 4000);

        // Medal's footer says arrows "navigate between clips"; make it say what they do now.
        const replacement = `to seek ${step} second${step === 1 ? "" : "s"}`;
        hintObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") rewriteHintsWithin(mutation.target, replacement);
                else mutation.addedNodes.forEach(added => rewriteHintsWithin(added, replacement));
            }
        });
        // Plugins start very early, before <html> exists, so watch the document itself (it always exists).
        hintObserver.observe(document, { childList: true, subtree: true, characterData: true });
        if (document.documentElement) rewriteHintsWithin(document.documentElement, replacement);
        console.info(`[ArrowSeek] footer hint rewrite is active (${BUILD_MARKER}, ${step}s)`);
    },
    stop() {
        if (blurPollTimer !== undefined) {
            window.clearInterval(blurPollTimer);
            blurPollTimer = undefined;
        }
        if (intentHandler) {
            window.removeEventListener("pointerdown", intentHandler, true);
            window.removeEventListener("keydown", intentHandler, true);
        }
        if (focusHandler) window.removeEventListener("focusin", focusHandler, true);
        if (keyHandler) window.removeEventListener("keydown", keyHandler, true);
        intentHandler = focusHandler = undefined;
        keyHandler = undefined;
        restoreHints();
    }
});