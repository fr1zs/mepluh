import { definePlugin } from "@shared/plugin";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const WHEEL_STEP = 0.25;
const DRAG_THRESHOLD_PX = 5;
const STYLE_ID = "mepluh-screenshot-zoom-style";
const FULLSCREEN_BTN_ATTR = "data-mepluh-screenshot-fs-btn";
const ZOOM_BADGE_ATTR = "data-mepluh-screenshot-zoom-badge";
const WINDOW_FS_ATTR = "data-mepluh-window-fs";

let clickHandler: ((event: MouseEvent) => void) | undefined;
let pointerDownHandler: ((event: PointerEvent) => void) | undefined;
let pointerUpHandler: ((event: PointerEvent) => void) | undefined;
let wheelHandler: ((event: WheelEvent) => void) | undefined;
let mouseDownHandler: ((event: MouseEvent) => void) | undefined;
let mouseMoveHandler: ((event: MouseEvent) => void) | undefined;
let mouseUpHandler: ((event: MouseEvent) => void) | undefined;
let keyDownHandler: ((event: KeyboardEvent) => void) | undefined;
let domObserver: MutationObserver | undefined;
let copyFeedbackTimer: number | undefined;
let isSyncing = false;

let activeImg: HTMLImageElement | null = null;
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let hasDragged = false;
let startX = 0;
let startY = 0;

interface ScreenshotTarget {
    container: HTMLElement;
    img: HTMLImageElement;
}

const EXPAND_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const COMPRESS_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

const injectStyle = (): void => {
    const root = document.head ?? document.documentElement;
    if (!root || document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        [class*="group/screenshot"] > div:not([${FULLSCREEN_BTN_ATTR}]):not([${ZOOM_BADGE_ATTR}]),
        [class*="group-hover/screenshot"]:not([${FULLSCREEN_BTN_ATTR}]):not([${ZOOM_BADGE_ATTR}]) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        [${FULLSCREEN_BTN_ATTR}="true"] {
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 30;
            width: 34px;
            height: 34px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(15, 15, 18, 0.72);
            backdrop-filter: blur(8px);
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.12s ease;
            pointer-events: auto !important;
        }
        [${ZOOM_BADGE_ATTR}="true"] {
            position: absolute;
            bottom: 12px;
            left: 12px;
            z-index: 30;
            height: 28px;
            padding: 0 9px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(15, 15, 18, 0.72);
            backdrop-filter: blur(8px);
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.02em;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            user-select: none;
            cursor: default;
            opacity: 0;
            transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.12s ease;
            pointer-events: auto !important;
        }
        [${ZOOM_BADGE_ATTR}="true"][data-zoomed="true"] {
            cursor: pointer;
        }
        [${ZOOM_BADGE_ATTR}="true"][data-zoomed="true"]:hover {
            background: rgba(32, 32, 38, 0.9);
            transform: scale(1.04);
        }
        [class*="group/screenshot"]:hover [${FULLSCREEN_BTN_ATTR}="true"],
        [class*="group/screenshot"]:hover [${ZOOM_BADGE_ATTR}="true"],
        [${FULLSCREEN_BTN_ATTR}="true"]:focus-visible,
        [${WINDOW_FS_ATTR}="true"] [${FULLSCREEN_BTN_ATTR}="true"],
        [${WINDOW_FS_ATTR}="true"] [${ZOOM_BADGE_ATTR}="true"] {
            opacity: 1;
        }
        [${FULLSCREEN_BTN_ATTR}="true"]:hover {
            background: rgba(32, 32, 38, 0.9);
            transform: scale(1.04);
        }
        [${FULLSCREEN_BTN_ATTR}="true"]:active {
            transform: scale(0.97);
        }
        [${WINDOW_FS_ATTR}="true"] {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            background: #000000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        [${WINDOW_FS_ATTR}="true"] img {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
        }
    `;
    root.appendChild(style);
};

const removeStyle = (): void => {
    document.getElementById(STYLE_ID)?.remove();
};

const getActiveScreenshot = (): ScreenshotTarget | null => {
    const container = document.querySelector<HTMLElement>('[class*="group/screenshot"]');
    if (!container) return null;
    const img = container.querySelector<HTMLImageElement>("img[alt='Screenshot'], img");
    if (!img) return null;
    return { container, img };
};

const getScreenshotTarget = (target: EventTarget | null): ScreenshotTarget | null => {
    if (!(target instanceof Element)) return null;
    if (target.closest(`[${FULLSCREEN_BTN_ATTR}="true"]`) || target.closest(`[${ZOOM_BADGE_ATTR}="true"]`)) {
        return null;
    }
    const container = target.closest<HTMLElement>('[class*="group/screenshot"]');
    if (!container) return null;
    const img = container.querySelector<HTMLImageElement>("img[alt='Screenshot'], img");
    if (!img) return null;
    return { container, img };
};

const updateZoomBadge = (container?: HTMLElement | null): void => {
    const targetContainer =
        container ??
        activeImg?.closest<HTMLElement>('[class*="group/screenshot"]') ??
        getActiveScreenshot()?.container;
    if (!targetContainer) return;

    const badge = targetContainer.querySelector<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
    if (!badge) return;

    const pct = `${Math.round(scale * 100)}%`;
    const isZoomed = scale > 1.01 ? "true" : "false";
    if (badge.textContent !== pct) badge.textContent = pct;
    if (badge.dataset.zoomed !== isZoomed) {
        badge.dataset.zoomed = isZoomed;
        badge.title = isZoomed === "true" ? "Reset zoom (100%)" : "Zoom level";
    }
};

const clampTranslation = (
    img: HTMLImageElement,
    targetScale: number,
    nextX: number,
    nextY: number
): { x: number; y: number } => {
    const rect = img.getBoundingClientRect();
    const baseWidth = rect.width / scale;
    const baseHeight = rect.height / scale;

    const maxOffsetX = Math.max(0, (baseWidth * targetScale - baseWidth) / 2);
    const maxOffsetY = Math.max(0, (baseHeight * targetScale - baseHeight) / 2);

    return {
        x: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextX)),
        y: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextY))
    };
};

const applyTransform = (img: HTMLImageElement, smooth: boolean): void => {
    img.style.willChange = scale > 1 ? "transform" : "auto";
    img.style.transition = smooth ? "transform 0.16s cubic-bezier(0.2, 0, 0, 1)" : "none";
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    const container = img.closest<HTMLElement>('[class*="group/screenshot"]');
    const cursor = scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in";
    img.style.cursor = cursor;
    if (container) container.style.cursor = cursor;
    updateZoomBadge(container);
};

const resetZoom = (smooth = true): void => {
    if (!activeImg) {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateZoomBadge();
        return;
    }
    const img = activeImg;
    scale = 1;
    translateX = 0;
    translateY = 0;
    isDragging = false;
    hasDragged = false;
    applyTransform(img, smooth);
    activeImg = null;
};

const updateFullscreenButtonState = (btn: HTMLButtonElement, container: HTMLElement): void => {
    const nextState = container.getAttribute(WINDOW_FS_ATTR) === "true" ? "fs" : "normal";
    if (btn.dataset.fsState === nextState) return;
    btn.dataset.fsState = nextState;
    btn.innerHTML = nextState === "fs" ? COMPRESS_SVG : EXPAND_SVG;
    btn.title = nextState === "fs" ? "Exit window fullscreen" : "Expand to window";
    btn.setAttribute("aria-label", btn.title);
};

const ensureOverlayControls = (container: HTMLElement): void => {
    if (container.style.position !== "relative" && getComputedStyle(container).position === "static") {
        container.style.position = "relative";
    }

    let btn = container.querySelector<HTMLButtonElement>(`button[${FULLSCREEN_BTN_ATTR}="true"]`);
    if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute(FULLSCREEN_BTN_ATTR, "true");
        container.appendChild(btn);
    }
    updateFullscreenButtonState(btn, container);

    let badge = container.querySelector<HTMLDivElement>(`div[${ZOOM_BADGE_ATTR}="true"]`);
    if (!badge) {
        badge = document.createElement("div");
        badge.setAttribute(ZOOM_BADGE_ATTR, "true");
        container.appendChild(badge);
    }
    updateZoomBadge(container);
};

const setWindowFullscreen = (container: HTMLElement, enabled: boolean): void => {
    isSyncing = true;
    try {
        resetZoom(false);
        if (enabled) {
            container.setAttribute(WINDOW_FS_ATTR, "true");
        } else {
            container.removeAttribute(WINDOW_FS_ATTR);
        }
        const btn = container.querySelector<HTMLButtonElement>(`button[${FULLSCREEN_BTN_ATTR}="true"]`);
        if (btn) updateFullscreenButtonState(btn, container);
        updateZoomBadge(container);
    } finally {
        isSyncing = false;
    }
};

const toggleWindowFullscreen = (container: HTMLElement): void => {
    const isCurrentlyFs = container.getAttribute(WINDOW_FS_ATTR) === "true";
    setWindowFullscreen(container, !isCurrentlyFs);
};

const zoomAtPoint = (
    img: HTMLImageElement,
    targetScale: number,
    clientX: number,
    clientY: number,
    smooth: boolean
): void => {
    if (activeImg && activeImg !== img) {
        resetZoom(false);
    }

    const clampedScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetScale));
    if (clampedScale <= 1.01) {
        resetZoom(smooth);
        return;
    }

    const rect = img.getBoundingClientRect();
    const imgCenterX = rect.left + rect.width / 2;
    const imgCenterY = rect.top + rect.height / 2;
    const offsetX = clientX - imgCenterX;
    const offsetY = clientY - imgCenterY;

    const scaleRatio = clampedScale / scale;
    const rawX = offsetX - (offsetX - translateX) * scaleRatio;
    const rawY = offsetY - (offsetY - translateY) * scaleRatio;

    const clamped = clampTranslation(img, clampedScale, rawX, rawY);
    translateX = clamped.x;
    translateY = clamped.y;
    scale = clampedScale;
    activeImg = img;

    applyTransform(img, smooth);
};

const copyScreenshotToClipboard = async (img: HTMLImageElement): Promise<boolean> => {
    try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) return false;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;

        ctx.drawImage(img, 0, 0, width, height);

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        if (!blob) return false;

        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return true;
    } catch (err) {
        console.error("[ScreenshotZoom] Failed to copy screenshot:", err);
        return false;
    }
};

const setButtonLabel = (btn: HTMLButtonElement, label: string, iconShape: "copy" | "check"): void => {
    const icon = btn.querySelector<HTMLElement>('[data-slot="standard-icon"]');
    if (icon) {
        icon.setAttribute("data-shape", iconShape);
        icon.style.maskImage = `url("./src/assets/icons/standard/${iconShape}.svg")`;
    }
    for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.nodeValue ?? "").trim().length > 0) {
            node.nodeValue = label;
            return;
        }
    }
    btn.appendChild(document.createTextNode(label));
};

const restoreStoryButton = (btn: HTMLButtonElement): void => {
    if (btn.dataset.mepluhCopyBtn !== "true") return;
    delete btn.dataset.mepluhCopyBtn;
    const icon = btn.querySelector<HTMLElement>('[data-slot="standard-icon"]');
    if (icon) {
        icon.setAttribute("data-shape", "stories");
        icon.style.maskImage = 'url("./src/assets/icons/standard/stories.svg")';
    }
    for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.nodeValue ?? "").trim().length > 0) {
            node.nodeValue = "Add to Story";
            return;
        }
    }
};

const syncScreenshotUI = (): void => {
    if (isSyncing) return;
    isSyncing = true;
    try {
        injectStyle();
        const active = getActiveScreenshot();

        if (active) {
            ensureOverlayControls(active.container);
        }

        const buttons = document.querySelectorAll<HTMLButtonElement>('[data-slot="button-group"] > button[data-slot="button"]');
        for (const btn of buttons) {
            const isStoryBtn =
                btn.dataset.mepluhCopyBtn === "true" ||
                btn.textContent?.includes("Add to Story") ||
                btn.querySelector('[data-shape="stories"]') !== null;

            if (!isStoryBtn) continue;

            if (active) {
                if (btn.dataset.mepluhCopyBtn !== "true") {
                    btn.dataset.mepluhCopyBtn = "true";
                    setButtonLabel(btn, "Copy", "copy");
                }
            } else {
                restoreStoryButton(btn);
            }
        }
    } finally {
        isSyncing = false;
    }
};

export default definePlugin({
    name: "ScreenshotZoom",
    description:
        "Zoom and pan into screenshots on click/scroll, expand to fill the Medal window, and replace the duplicate Add to Story button with Copy.",
    category: "Experimental",
    enabledByDefault: true,
    options: {
        clickZoom: {
            type: "string",
            label: "Click zoom multiplier",
            description: "Zoom level when clicking a screenshot (e.g. 2.5)",
            default: "2.5"
        }
    },
    start({ options }) {
        const parsed = Number.parseFloat(options.clickZoom);
        const clickZoomLevel = Number.isFinite(parsed) && parsed > 1 ? Math.min(MAX_ZOOM, parsed) : 2.5;

        injectStyle();

        clickHandler = (event: MouseEvent): void => {
            if (event.button !== 0) return;

            if (event.target instanceof Element) {
                const zoomBadge = event.target.closest<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
                if (zoomBadge) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (scale > 1) resetZoom(true);
                    return;
                }

                const fsBtn = event.target.closest<HTMLButtonElement>(`button[${FULLSCREEN_BTN_ATTR}="true"]`);
                if (fsBtn) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    const container = fsBtn.closest<HTMLElement>('[class*="group/screenshot"]');
                    if (container) toggleWindowFullscreen(container);
                    return;
                }

                const copyBtn = event.target.closest<HTMLButtonElement>('button[data-mepluh-copy-btn="true"]');
                if (copyBtn) {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    const active = getActiveScreenshot();
                    if (!active) return;

                    void copyScreenshotToClipboard(active.img).then(ok => {
                        if (!ok || copyBtn.dataset.mepluhCopyBtn !== "true") return;
                        setButtonLabel(copyBtn, "Copied!", "check");
                        if (copyFeedbackTimer !== undefined) window.clearTimeout(copyFeedbackTimer);
                        copyFeedbackTimer = window.setTimeout(() => {
                            if (copyBtn.isConnected && copyBtn.dataset.mepluhCopyBtn === "true") {
                                setButtonLabel(copyBtn, "Copy", "copy");
                            }
                        }, 1500);
                    });
                    return;
                }
            }

            const found = getScreenshotTarget(event.target);
            if (!found) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (hasDragged) {
                hasDragged = false;
                return;
            }

            if (scale > 1) {
                resetZoom(true);
            } else {
                zoomAtPoint(found.img, clickZoomLevel, event.clientX, event.clientY, true);
            }
        };

        pointerDownHandler = (event: PointerEvent): void => {
            if (event.button !== 0) return;
            if (getScreenshotTarget(event.target)) {
                event.stopImmediatePropagation();
                return;
            }
            if (
                event.target instanceof Element &&
                (event.target.closest('button[data-mepluh-copy-btn="true"]') ||
                    event.target.closest(`button[${FULLSCREEN_BTN_ATTR}="true"]`) ||
                    event.target.closest(`[${ZOOM_BADGE_ATTR}="true"]`))
            ) {
                event.stopImmediatePropagation();
            }
        };

        pointerUpHandler = (event: PointerEvent): void => {
            if (event.button !== 0) return;
            if (getScreenshotTarget(event.target)) {
                event.stopImmediatePropagation();
                return;
            }
            if (
                event.target instanceof Element &&
                (event.target.closest('button[data-mepluh-copy-btn="true"]') ||
                    event.target.closest(`button[${FULLSCREEN_BTN_ATTR}="true"]`) ||
                    event.target.closest(`[${ZOOM_BADGE_ATTR}="true"]`))
            ) {
                event.stopImmediatePropagation();
            }
        };

        wheelHandler = (event: WheelEvent): void => {
            const found = getScreenshotTarget(event.target);
            if (!found) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            const delta = event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
            zoomAtPoint(found.img, scale + delta, event.clientX, event.clientY, false);
        };

        mouseDownHandler = (event: MouseEvent): void => {
            if (event.button !== 0) return;
            const found = getScreenshotTarget(event.target);
            if (!found) return;

            event.preventDefault();
            if (scale <= 1) return;

            event.stopImmediatePropagation();
            isDragging = true;
            hasDragged = false;
            startX = event.clientX - translateX;
            startY = event.clientY - translateY;
            applyTransform(found.img, false);
        };

        mouseMoveHandler = (event: MouseEvent): void => {
            if (!isDragging || !activeImg) return;

            const rawX = event.clientX - startX;
            const rawY = event.clientY - startY;

            if (Math.abs(rawX - translateX) > DRAG_THRESHOLD_PX || Math.abs(rawY - translateY) > DRAG_THRESHOLD_PX) {
                hasDragged = true;
            }

            const clamped = clampTranslation(activeImg, scale, rawX, rawY);
            translateX = clamped.x;
            translateY = clamped.y;
            applyTransform(activeImg, false);
        };

        mouseUpHandler = (): void => {
            if (!isDragging) return;
            isDragging = false;
            if (activeImg) applyTransform(activeImg, false);
        };

        keyDownHandler = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") return;

            if (scale > 1) {
                event.preventDefault();
                event.stopImmediatePropagation();
                resetZoom(true);
                return;
            }

            const fsContainer = document.querySelector<HTMLElement>(`[${WINDOW_FS_ATTR}="true"]`);
            if (fsContainer) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setWindowFullscreen(fsContainer, false);
            }
        };

        window.addEventListener("click", clickHandler, true);
        window.addEventListener("pointerdown", pointerDownHandler, true);
        window.addEventListener("pointerup", pointerUpHandler, true);
        window.addEventListener("wheel", wheelHandler, { capture: true, passive: false });
        window.addEventListener("mousedown", mouseDownHandler, true);
        window.addEventListener("mousemove", mouseMoveHandler, true);
        window.addEventListener("mouseup", mouseUpHandler, true);
        window.addEventListener("keydown", keyDownHandler, true);

        domObserver = new MutationObserver(() => syncScreenshotUI());
        domObserver.observe(document, { childList: true, subtree: true });
        if (document.documentElement) syncScreenshotUI();
    },
    stop() {
        domObserver?.disconnect();
        domObserver = undefined;

        if (copyFeedbackTimer !== undefined) {
            window.clearTimeout(copyFeedbackTimer);
            copyFeedbackTimer = undefined;
        }

        document.querySelectorAll<HTMLElement>(`[${WINDOW_FS_ATTR}="true"]`).forEach(el => {
            el.removeAttribute(WINDOW_FS_ATTR);
        });
        document.querySelectorAll(`button[${FULLSCREEN_BTN_ATTR}="true"]`).forEach(btn => btn.remove());
        document.querySelectorAll(`div[${ZOOM_BADGE_ATTR}="true"]`).forEach(badge => badge.remove());
        removeStyle();

        document
            .querySelectorAll<HTMLButtonElement>('button[data-mepluh-copy-btn="true"]')
            .forEach(restoreStoryButton);

        resetZoom(false);

        if (clickHandler) window.removeEventListener("click", clickHandler, true);
        if (pointerDownHandler) window.removeEventListener("pointerdown", pointerDownHandler, true);
        if (pointerUpHandler) window.removeEventListener("pointerup", pointerUpHandler, true);
        if (wheelHandler) window.removeEventListener("wheel", wheelHandler, true);
        if (mouseDownHandler) window.removeEventListener("mousedown", mouseDownHandler, true);
        if (mouseMoveHandler) window.removeEventListener("mousemove", mouseMoveHandler, true);
        if (mouseUpHandler) window.removeEventListener("mouseup", mouseUpHandler, true);
        if (keyDownHandler) window.removeEventListener("keydown", keyDownHandler, true);

        clickHandler = undefined;
        pointerDownHandler = undefined;
        pointerUpHandler = undefined;
        wheelHandler = undefined;
        mouseDownHandler = undefined;
        mouseMoveHandler = undefined;
        mouseUpHandler = undefined;
        keyDownHandler = undefined;
    }
});