import { definePlugin } from "@shared/plugin";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const WHEEL_STEP = 0.25;
const DRAG_THRESHOLD_PX = 5;
const ZOOM_BADGE_VISIBLE_MS = 1400;
const MOUSE_IDLE_MS = 1500;
const STYLE_ID = "mepluh-screenshot-zoom-style";
const FULLSCREEN_BTN_ATTR = "data-mepluh-screenshot-fs-btn";
const ZOOM_BADGE_ATTR = "data-mepluh-screenshot-zoom-badge";
const WINDOW_FS_ATTR = "data-mepluh-window-fs";
const IDLE_HIDDEN_ATTR = "data-mepluh-idle-hidden";
const ZOOM_VISIBLE_ATTR = "data-mepluh-zoom-visible";

let clickHandler: ((event: MouseEvent) => void) | undefined;
let pointerDownHandler: ((event: PointerEvent) => void) | undefined;
let pointerUpHandler: ((event: PointerEvent) => void) | undefined;
let wheelHandler: ((event: WheelEvent) => void) | undefined;
let mouseDownHandler: ((event: MouseEvent) => void) | undefined;
let mouseMoveHandler: ((event: MouseEvent) => void) | undefined;
let mouseUpHandler: ((event: MouseEvent) => void) | undefined;
let mouseLeaveHandler: ((event: MouseEvent) => void) | undefined;
let windowBlurHandler: (() => void) | undefined;
let keyDownHandler: ((event: KeyboardEvent) => void) | undefined;
let domObserver: MutationObserver | undefined;
let copyFeedbackTimer: number | undefined;
let zoomBadgeTimer: number | undefined;
let mouseIdleTimer: number | undefined;
let isSyncing = false;

let activeImg: HTMLImageElement | null = null;
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let hasDragged = false;
let startX = 0;
let startY = 0;
let isMouseIdle = false;
let isZoomBadgeVisible = false;

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
            transition: opacity 0.18s ease, background-color 0.15s ease, transform 0.12s ease;
            pointer-events: none;
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
            transition: opacity 0.18s ease, background-color 0.15s ease, transform 0.12s ease;
            pointer-events: none;
        }
        [${ZOOM_BADGE_ATTR}="true"][${ZOOM_VISIBLE_ATTR}="true"] {
            opacity: 1;
            pointer-events: auto !important;
        }
        [${ZOOM_BADGE_ATTR}="true"][data-zoomed="true"] {
            cursor: pointer;
        }
        [${ZOOM_BADGE_ATTR}="true"][data-zoomed="true"]:hover {
            background: rgba(32, 32, 38, 0.9);
            transform: scale(1.04);
        }
        [class*="group/screenshot"]:hover:not([${IDLE_HIDDEN_ATTR}="true"]) [${FULLSCREEN_BTN_ATTR}="true"],
        [${WINDOW_FS_ATTR}="true"]:not([${IDLE_HIDDEN_ATTR}="true"]) [${FULLSCREEN_BTN_ATTR}="true"] {
            opacity: 1;
            pointer-events: auto !important;
        }
        [class*="group/screenshot"][${IDLE_HIDDEN_ATTR}="true"],
        [class*="group/screenshot"][${IDLE_HIDDEN_ATTR}="true"] * {
            cursor: none !important;
        }
        [class*="group/screenshot"][${IDLE_HIDDEN_ATTR}="true"] [${FULLSCREEN_BTN_ATTR}="true"],
        [class*="group/screenshot"][${IDLE_HIDDEN_ATTR}="true"] [${ZOOM_BADGE_ATTR}="true"] {
            opacity: 0 !important;
            pointer-events: none !important;
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

const syncIdleStateOnDom = (container?: HTMLElement | null): void => {
    const target = container ?? getActiveScreenshot()?.container;
    if (!target) return;
    if (isMouseIdle) {
        if (target.getAttribute(IDLE_HIDDEN_ATTR) !== "true") {
            target.setAttribute(IDLE_HIDDEN_ATTR, "true");
        }
    } else if (target.hasAttribute(IDLE_HIDDEN_ATTR)) {
        target.removeAttribute(IDLE_HIDDEN_ATTR);
    }
};

const setMouseIdle = (idle: boolean, container?: HTMLElement | null): void => {
    isMouseIdle = idle;
    if (idle) {
        isZoomBadgeVisible = false;
        if (zoomBadgeTimer !== undefined) {
            window.clearTimeout(zoomBadgeTimer);
            zoomBadgeTimer = undefined;
        }
        const target = container ?? getActiveScreenshot()?.container;
        const badge = target?.querySelector<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
        badge?.removeAttribute(ZOOM_VISIBLE_ATTR);
    }
    syncIdleStateOnDom(container);
};

const bumpMouseActivity = (container?: HTMLElement | null): void => {
    if (mouseIdleTimer !== undefined) {
        window.clearTimeout(mouseIdleTimer);
        mouseIdleTimer = undefined;
    }
    if (isMouseIdle) {
        setMouseIdle(false, container);
    }
    mouseIdleTimer = window.setTimeout(() => {
        mouseIdleTimer = undefined;
        if (!isDragging) {
            setMouseIdle(true, container);
        }
    }, MOUSE_IDLE_MS);
};

const flashZoomBadge = (container?: HTMLElement | null): void => {
    const targetContainer =
        container ??
        activeImg?.closest<HTMLElement>('[class*="group/screenshot"]') ??
        getActiveScreenshot()?.container;
    if (!targetContainer) return;

    if (isMouseIdle) {
        setMouseIdle(false, targetContainer);
    }
    bumpMouseActivity(targetContainer);

    isZoomBadgeVisible = true;
    const badge = targetContainer.querySelector<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
    if (badge) {
        badge.setAttribute(ZOOM_VISIBLE_ATTR, "true");
    }

    if (zoomBadgeTimer !== undefined) {
        window.clearTimeout(zoomBadgeTimer);
    }
    zoomBadgeTimer = window.setTimeout(() => {
        zoomBadgeTimer = undefined;
        isZoomBadgeVisible = false;
        const currentBadge = (
            targetContainer.isConnected ? targetContainer : getActiveScreenshot()?.container
        )?.querySelector<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
        currentBadge?.removeAttribute(ZOOM_VISIBLE_ATTR);
    }, ZOOM_BADGE_VISIBLE_MS);
};

const updateZoomBadge = (container?: HTMLElement | null, announceChange = false): void => {
    const targetContainer =
        container ??
        activeImg?.closest<HTMLElement>('[class*="group/screenshot"]') ??
        getActiveScreenshot()?.container;
    if (!targetContainer) return;

    const badge = targetContainer.querySelector<HTMLElement>(`[${ZOOM_BADGE_ATTR}="true"]`);
    if (!badge) return;

    const pct = `${Math.round(scale * 100)}%`;
    const isZoomed = scale > 1.01 ? "true" : "false";
    const changed = badge.textContent !== pct;
    if (changed) badge.textContent = pct;
    if (badge.dataset.zoomed !== isZoomed) {
        badge.dataset.zoomed = isZoomed;
        badge.title = isZoomed === "true" ? "Reset zoom (100%)" : "Zoom level";
    }

    if (announceChange && changed) {
        flashZoomBadge(targetContainer);
    } else if (isZoomBadgeVisible && !isMouseIdle) {
        badge.setAttribute(ZOOM_VISIBLE_ATTR, "true");
    } else {
        badge.removeAttribute(ZOOM_VISIBLE_ATTR);
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

const applyTransform = (img: HTMLImageElement, smooth: boolean, announceZoom = false): void => {
    img.style.willChange = scale > 1 ? "transform" : "auto";
    img.style.transition = smooth ? "transform 0.16s cubic-bezier(0.2, 0, 0, 1)" : "none";
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    const container = img.closest<HTMLElement>('[class*="group/screenshot"]');
    const cursor = scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in";
    img.style.cursor = cursor;
    if (container) container.style.cursor = cursor;
    updateZoomBadge(container, announceZoom);
};

const resetZoom = (smooth = true, announceZoom = true): void => {
    if (!activeImg) {
        const hadZoom = scale !== 1;
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateZoomBadge(undefined, announceZoom && hadZoom);
        return;
    }
    const img = activeImg;
    const hadZoom = scale !== 1;
    scale = 1;
    translateX = 0;
    translateY = 0;
    isDragging = false;
    hasDragged = false;
    applyTransform(img, smooth, announceZoom && hadZoom);
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
    updateZoomBadge(container, false);
    syncIdleStateOnDom(container);
};

const setWindowFullscreen = (container: HTMLElement, enabled: boolean): void => {
    isSyncing = true;
    try {
        resetZoom(false, false);
        if (enabled) {
            container.setAttribute(WINDOW_FS_ATTR, "true");
        } else {
            container.removeAttribute(WINDOW_FS_ATTR);
        }
        const btn = container.querySelector<HTMLButtonElement>(`button[${FULLSCREEN_BTN_ATTR}="true"]`);
        if (btn) updateFullscreenButtonState(btn, container);
        updateZoomBadge(container, false);
        bumpMouseActivity(container);
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
        resetZoom(false, false);
    }

    const clampedScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetScale));
    if (clampedScale <= 1.01) {
        resetZoom(smooth, true);
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

    applyTransform(img, smooth, true);
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
                    if (scale > 1) resetZoom(true, true);
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
            bumpMouseActivity(found.container);

            if (hasDragged) {
                hasDragged = false;
                return;
            }

            if (scale > 1) {
                resetZoom(true, true);
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
            bumpMouseActivity(found.container);
            if (scale <= 1) return;

            event.stopImmediatePropagation();
            isDragging = true;
            hasDragged = false;
            startX = event.clientX - translateX;
            startY = event.clientY - translateY;
            applyTransform(found.img, false, false);
        };

        mouseMoveHandler = (event: MouseEvent): void => {
            const active = getActiveScreenshot();
            if (active) {
                const insideContainer =
                    event.target instanceof Element && active.container.contains(event.target);
                if (insideContainer || isDragging) {
                    bumpMouseActivity(active.container);
                } else if (!isMouseIdle) {
                    if (mouseIdleTimer !== undefined) {
                        window.clearTimeout(mouseIdleTimer);
                        mouseIdleTimer = undefined;
                    }
                    setMouseIdle(true, active.container);
                }
            }

            if (!isDragging || !activeImg) return;

            const rawX = event.clientX - startX;
            const rawY = event.clientY - startY;

            if (Math.abs(rawX - translateX) > DRAG_THRESHOLD_PX || Math.abs(rawY - translateY) > DRAG_THRESHOLD_PX) {
                hasDragged = true;
            }

            const clamped = clampTranslation(activeImg, scale, rawX, rawY);
            translateX = clamped.x;
            translateY = clamped.y;
            applyTransform(activeImg, false, false);
        };

        mouseUpHandler = (): void => {
            if (!isDragging) return;
            isDragging = false;
            if (activeImg) {
                applyTransform(activeImg, false, false);
                bumpMouseActivity(activeImg.closest<HTMLElement>('[class*="group/screenshot"]'));
            }
        };

        mouseLeaveHandler = (event: MouseEvent): void => {
            if (event.relatedTarget !== null) return;
            if (mouseIdleTimer !== undefined) {
                window.clearTimeout(mouseIdleTimer);
                mouseIdleTimer = undefined;
            }
            setMouseIdle(true);
        };

        windowBlurHandler = (): void => {
            if (mouseIdleTimer !== undefined) {
                window.clearTimeout(mouseIdleTimer);
                mouseIdleTimer = undefined;
            }
            setMouseIdle(true);
        };

        keyDownHandler = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") return;

            if (scale > 1) {
                event.preventDefault();
                event.stopImmediatePropagation();
                resetZoom(true, true);
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
        document.addEventListener("mouseleave", mouseLeaveHandler, true);
        window.addEventListener("blur", windowBlurHandler, true);
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
        if (zoomBadgeTimer !== undefined) {
            window.clearTimeout(zoomBadgeTimer);
            zoomBadgeTimer = undefined;
        }
        if (mouseIdleTimer !== undefined) {
            window.clearTimeout(mouseIdleTimer);
            mouseIdleTimer = undefined;
        }

        document.querySelectorAll<HTMLElement>(`[${WINDOW_FS_ATTR}="true"]`).forEach(el => {
            el.removeAttribute(WINDOW_FS_ATTR);
        });
        document.querySelectorAll<HTMLElement>(`[${IDLE_HIDDEN_ATTR}="true"]`).forEach(el => {
            el.removeAttribute(IDLE_HIDDEN_ATTR);
        });
        document.querySelectorAll(`button[${FULLSCREEN_BTN_ATTR}="true"]`).forEach(btn => btn.remove());
        document.querySelectorAll(`div[${ZOOM_BADGE_ATTR}="true"]`).forEach(badge => badge.remove());
        removeStyle();

        document
            .querySelectorAll<HTMLButtonElement>('button[data-mepluh-copy-btn="true"]')
            .forEach(restoreStoryButton);

        resetZoom(false, false);

        if (clickHandler) window.removeEventListener("click", clickHandler, true);
        if (pointerDownHandler) window.removeEventListener("pointerdown", pointerDownHandler, true);
        if (pointerUpHandler) window.removeEventListener("pointerup", pointerUpHandler, true);
        if (wheelHandler) window.removeEventListener("wheel", wheelHandler, true);
        if (mouseDownHandler) window.removeEventListener("mousedown", mouseDownHandler, true);
        if (mouseMoveHandler) window.removeEventListener("mousemove", mouseMoveHandler, true);
        if (mouseUpHandler) window.removeEventListener("mouseup", mouseUpHandler, true);
        if (mouseLeaveHandler) document.removeEventListener("mouseleave", mouseLeaveHandler, true);
        if (windowBlurHandler) window.removeEventListener("blur", windowBlurHandler, true);
        if (keyDownHandler) window.removeEventListener("keydown", keyDownHandler, true);

        clickHandler = undefined;
        pointerDownHandler = undefined;
        pointerUpHandler = undefined;
        wheelHandler = undefined;
        mouseDownHandler = undefined;
        mouseMoveHandler = undefined;
        mouseUpHandler = undefined;
        mouseLeaveHandler = undefined;
        windowBlurHandler = undefined;
        keyDownHandler = undefined;
    }
});