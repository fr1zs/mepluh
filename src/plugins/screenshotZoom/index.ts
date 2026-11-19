import { definePlugin } from "@shared/plugin";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const WHEEL_STEP = 0.25;
const DRAG_THRESHOLD_PX = 5;
const STYLE_ID = "mepluh-screenshot-zoom-style";

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

const injectStyle = (): void => {
    const root = document.head ?? document.documentElement;
    if (!root || document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        [class*="group/screenshot"] > div,
        [class*="group-hover/screenshot"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
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
    const container = target.closest<HTMLElement>('[class*="group/screenshot"]');
    if (!container) return null;
    const img = container.querySelector<HTMLImageElement>("img[alt='Screenshot'], img");
    if (!img) return null;
    return { container, img };
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
};

const resetZoom = (smooth = true): void => {
    if (!activeImg) return;
    const img = activeImg;
    scale = 1;
    translateX = 0;
    translateY = 0;
    isDragging = false;
    hasDragged = false;
    applyTransform(img, smooth);
    activeImg = null;
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
    injectStyle();
    const active = getActiveScreenshot();

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
};

export default definePlugin({
    name: "ScreenshotZoom",
    description: "Zoom and pan into screenshots on click/scroll, and replace the duplicate Add to Story button with Copy.",
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
            if (event.target instanceof Element && event.target.closest('button[data-mepluh-copy-btn="true"]')) {
                event.stopImmediatePropagation();
            }
        };

        pointerUpHandler = (event: PointerEvent): void => {
            if (event.button !== 0) return;
            if (getScreenshotTarget(event.target)) {
                event.stopImmediatePropagation();
                return;
            }
            if (event.target instanceof Element && event.target.closest('button[data-mepluh-copy-btn="true"]')) {
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
            if (event.key === "Escape" && scale > 1) {
                event.preventDefault();
                event.stopImmediatePropagation();
                resetZoom(true);
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