import { chunkMarker } from "@shared/chunkPatches";
import { definePlugin } from "@shared/plugin";

const BANNER_PREFIX = "Unlock more sound effects with";
const NEW_BANNER_TEXT = "Custom sounds unlocked thanks to Mepluh!";
const SKIP_PARENT_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "TEMPLATE"]);

let observer: MutationObserver | undefined;
let pressHandler: ((event: Event) => void) | undefined;

const rewriteBannerTextNode = (node: Text): void => {
    const value = node.nodeValue;
    if (!value || value.length > 200 || !value.includes(BANNER_PREFIX)) return;
    if (node.parentElement && SKIP_PARENT_TAGS.has(node.parentElement.tagName)) return;

    // Replace the leading text node and remove the trailing "PREMIUM!" span if present
    const parent = node.parentElement;
    node.nodeValue = NEW_BANNER_TEXT;
    if (parent) {
        for (const child of Array.from(parent.childNodes)) {
            if (child !== node) child.textContent = "";
        }
    }
};

const rewriteBannerWithin = (root: Node): void => {
    if (root.nodeType === Node.TEXT_NODE) return rewriteBannerTextNode(root as Text);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        rewriteBannerTextNode(node as Text);
    }
};

const isSoundBannerButton = (target: EventTarget | null): HTMLButtonElement | null => {
    if (!(target instanceof Element)) return null;
    const button = target.closest("button");
    if (!button) return null;

    const text = button.textContent ?? "";
    if (text.includes(BANNER_PREFIX) || text.includes(NEW_BANNER_TEXT)) {
        return button;
    }
    return null;
};

export default definePlugin({
    name: "UnlockSoundAlerts",
    description: "Unlocks all premium sound alert options (Suspense, Quack, Sparkle, Pop, Retro, Clown Horn, Custom).",
    category: "Experimental",
    enabledByDefault: true,
    patches: [
        {
            find: chunkMarker("renderer-SoundAlerts"),
            replacement: {
                match: /,(\w+)=(\w+)\(\),(\w+)=(\w+)\(\),(\w+)=(\w+)\(\3\),(\w+)=(\w+)\(\),(\w+)=!\5/,
                replace: ",$1=$2(),$3=$4(),$5=$6($3),$7=$8(),$9=!1"
            }
        },
        {
            find: chunkMarker("renderer-SoundAlerts"),
            replacement: {
                match: /(\w+)\(\),"src","assets","sound-alerts"/,
                replace: '$1().replace(/\\.asar(?=$|[\\\\/])/,".asar.unpacked"),"src","assets","sound-alerts"'
            }
        }
    ],
    start() {
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") rewriteBannerWithin(mutation.target);
                else mutation.addedNodes.forEach(added => rewriteBannerWithin(added));
            }
        });
        observer.observe(document, { childList: true, subtree: true, characterData: true });
        if (document.documentElement) rewriteBannerWithin(document.documentElement);

        pressHandler = (event: Event) => {
            const button = isSoundBannerButton(event.target);
            if (!button) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (event.type === "click") {
                const mepluhNav = Array.from(document.querySelectorAll<HTMLElement>("div")).find(
                    el => el.childElementCount === 0 && el.textContent?.trim() === "Mepluh"
                );
                mepluhNav?.click();
            }
        };

        window.addEventListener("pointerdown", pressHandler, true);
        window.addEventListener("mousedown", pressHandler, true);
        window.addEventListener("click", pressHandler, true);
    },
    stop() {
        observer?.disconnect();
        observer = undefined;

        if (pressHandler) {
            window.removeEventListener("pointerdown", pressHandler, true);
            window.removeEventListener("mousedown", pressHandler, true);
            window.removeEventListener("click", pressHandler, true);
            pressHandler = undefined;
        }
    }
});