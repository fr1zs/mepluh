import { definePlugin } from "@shared/plugin";

const USER_INTENT_MS = 350;
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

let keyHandler: ((event: KeyboardEvent) => void) | undefined;
let focusHandler: ((event: FocusEvent) => void) | undefined;
let intentHandler: ((event: Event) => void) | undefined;
let blurPollTimer: number | undefined;
let isDispatchingSyntheticNav = false;

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

const isViewingScreenshot = (): boolean => {
    if (document.querySelector('[class*="group/screenshot"]') !== null) return true;
    const playerSection = document.querySelector(".playerSection");
    if (playerSection && playerSection.querySelector("video") === null && playerSection.querySelector("img") !== null) {
        return true;
    }
    return false;
};

const isInMediaViewer = (): boolean => {
    if (findVideo() !== undefined || isViewingScreenshot()) return true;
    return document.querySelector(".playerSection") !== null;
};

const triggerNativeMediaNavigation = (direction: "prev" | "next"): void => {
    const mappedKey = direction === "prev" ? "ArrowLeft" : "ArrowRight";
    const mappedCode = direction === "prev" ? "ArrowLeft" : "ArrowRight";
    const mappedKeyCode = direction === "prev" ? 37 : 39;

    isDispatchingSyntheticNav = true;
    try {
        const synthetic = new KeyboardEvent("keydown", {
            key: mappedKey,
            code: mappedCode,
            keyCode: mappedKeyCode,
            which: mappedKeyCode,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(synthetic);
    } finally {
        isDispatchingSyntheticNav = false;
    }
};

const HINT_PHRASE = "to navigate between clips";
const CUSTOM_HINT_ATTR = "data-arrowseek-footer";
const SKIP_PARENT_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "TEMPLATE"]);
const BUILD_MARKER = "footer-hint-v14";

let hintObserver: MutationObserver | undefined;
let isUpdatingHints = false;
const originalContainers = new Map<HTMLElement, string>();

const makeVerticalIcon = (sourceIcon: Element, direction: "up" | "down"): HTMLElement => {
    const clone = sourceIcon.cloneNode(true) as HTMLElement;
    const shapeEl = clone.matches("[data-shape]") ? clone : clone.querySelector<HTMLElement>("[data-shape]");

    if (shapeEl) {
        const shape = shapeEl.getAttribute("data-shape") ?? "";
        const updatedShape = shape.replace(/left|right/, direction);
        shapeEl.setAttribute("data-shape", updatedShape);
        if (shapeEl.style.maskImage) {
            shapeEl.style.maskImage = shapeEl.style.maskImage.replace(/left|right/, direction);
        }
        if (shapeEl.style.webkitMaskImage) {
            shapeEl.style.webkitMaskImage = shapeEl.style.webkitMaskImage.replace(/left|right/, direction);
        }
        return clone;
    }

    const innerGraphic = clone.querySelector<HTMLElement>("svg") ?? clone;
    innerGraphic.style.transform = direction === "up" ? "rotate(90deg)" : "rotate(-90deg)";
    return clone;
};

const findFooterContainer = (textNode: Text): HTMLElement | null => {
    let el = textNode.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
        if (SKIP_PARENT_TAGS.has(el.tagName)) return null;
        const text = el.textContent ?? "";
        if (text.includes(HINT_PHRASE) && text.toLowerCase().includes("delete") && el.children.length >= 2) {
            return el;
        }
        el = el.parentElement;
    }
    return textNode.parentElement;
};

const buildFooterHint = (container: HTMLElement, step: number, showClipPart: boolean): void => {
    if (!originalContainers.has(container)) {
        originalContainers.set(container, container.innerHTML);
    }

    const template = document.createElement("div");
    template.innerHTML = originalContainers.get(container) ?? container.innerHTML;

    const children = Array.from(template.children);
    const arrowLeftOriginal = children[0] ?? null;
    const arrowRightOriginal = children[1] ?? null;
    const deleteIconOriginal = children[2] ?? null;

    const nodes: Node[] = [document.createTextNode("Use ")];
    if (arrowLeftOriginal) nodes.push(makeVerticalIcon(arrowLeftOriginal, "up"));
    nodes.push(document.createTextNode(" and "));
    if (arrowRightOriginal) nodes.push(makeVerticalIcon(arrowRightOriginal, "down"));
    nodes.push(document.createTextNode(" to navigate between media. "));

    if (showClipPart) {
        const unit = step === 1 ? "second" : "seconds";
        if (arrowLeftOriginal) nodes.push(arrowLeftOriginal.cloneNode(true));
        nodes.push(document.createTextNode(" and "));
        if (arrowRightOriginal) nodes.push(arrowRightOriginal.cloneNode(true));
        nodes.push(document.createTextNode(` to seek ${step} ${unit}. `));
    }

    if (deleteIconOriginal) nodes.push(deleteIconOriginal.cloneNode(true));
    nodes.push(document.createTextNode(" to delete."));

    container.replaceChildren(...nodes);
    container.setAttribute(CUSTOM_HINT_ATTR, showClipPart ? "clip" : "media");
};

const syncFooterHints = (step: number): void => {
    if (!document.documentElement || isUpdatingHints) return;
    isUpdatingHints = true;
    try {
        const showClipPart = !isViewingScreenshot();
        const desiredMode = showClipPart ? "clip" : "media";

        for (const container of Array.from(document.querySelectorAll<HTMLElement>(`[${CUSTOM_HINT_ATTR}]`))) {
            if (!container.isConnected) {
                originalContainers.delete(container);
                continue;
            }
            if (container.getAttribute(CUSTOM_HINT_ATTR) !== desiredMode) {
                buildFooterHint(container, step, showClipPart);
            }
        }

        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
            if (!node.nodeValue || !node.nodeValue.includes(HINT_PHRASE)) continue;
            const container = findFooterContainer(node);
            if (!container || container.hasAttribute(CUSTOM_HINT_ATTR)) continue;
            buildFooterHint(container, step, showClipPart);
        }
    } finally {
        isUpdatingHints = false;
    }
};

const restoreHints = (): void => {
    hintObserver?.disconnect();
    hintObserver = undefined;
    isUpdatingHints = true;
    try {
        for (const [container, originalHtml] of originalContainers) {
            if (container.isConnected) {
                container.innerHTML = originalHtml;
                container.removeAttribute(CUSTOM_HINT_ATTR);
            }
        }
    } finally {
        isUpdatingHints = false;
    }
    originalContainers.clear();
};

export default definePlugin({
    name: "ArrowSeek",
    description:
        "Left/Right arrow keys seek in videos, and Up/Down arrow keys navigate between previous/next media globally.",
    category: "Experimental",
    enabledByDefault: true,
    options: {
        seconds: {
            type: "string",
            label: "Skip length (seconds)",
            description: "How far the Left/Right arrow keys seek in videos",
            default: "5"
        }
    },
    start({ options }) {
        const parsed = Number.parseFloat(options.seconds);
        const step = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
        let lastUserIntent = 0;
        let clickedTarget: EventTarget | null = null;

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
            return clickedTarget === null || (clickedTarget instanceof Node && target.contains(clickedTarget));
        };

        const blurIfAutofocused = (target: Element | null): void => {
            if (!(target instanceof HTMLElement) || !isCaptionOrDescriptionBox(target)) return;
            if (shouldAllowFocus(target)) return;
            target.blur();
            target.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
            target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
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
            if (isDispatchingSyntheticNav) return;

            const isHorizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
            const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
            if (!isHorizontal && !isVertical) return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (isTyping(event.target)) return;

            if (isVertical) {
                if (!isInMediaViewer()) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                if (isEmptyTextField(event.target)) event.target.blur();
                triggerNativeMediaNavigation(event.key === "ArrowUp" ? "prev" : "next");
                return;
            }

            // Left/Right are exclusively for video seeking inside the media viewer.
            const video = findVideo();
            if (video) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (isEmptyTextField(event.target)) event.target.blur();

                const delta = event.key === "ArrowRight" ? step : -step;
                const max = Number.isFinite(video.duration) ? video.duration : Infinity;
                video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), max);
                return;
            }

            // Block Left/Right from switching media when viewing a screenshot so navigation stays on Up/Down.
            if (isViewingScreenshot()) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (isEmptyTextField(event.target)) event.target.blur();
            }
        };

        window.addEventListener("pointerdown", intentHandler, true);
        window.addEventListener("keydown", intentHandler, true);
        window.addEventListener("focusin", focusHandler, true);
        window.addEventListener("keydown", keyHandler, true);

        blurIfAutofocused(document.activeElement);
        blurPollTimer = window.setInterval(() => blurIfAutofocused(document.activeElement), 250);
        window.setTimeout(() => {
            if (blurPollTimer !== undefined) {
                window.clearInterval(blurPollTimer);
                blurPollTimer = undefined;
            }
        }, 4000);

        hintObserver = new MutationObserver(() => {
            syncFooterHints(step);
        });
        hintObserver.observe(document, { childList: true, subtree: true, characterData: true });
        syncFooterHints(step);
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