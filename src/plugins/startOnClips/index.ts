import { definePlugin } from "@shared/plugin";

interface MedalDataRouter {
    state?: {
        location?: {
            pathname?: string;
        };
    };
    navigate: (to: unknown, options?: { replace?: boolean }) => void | Promise<void>;
}

interface DataRouterHolder {
    promise?: Promise<MedalDataRouter>;
}

const BOOT_GUARD_MS = 5_000;

let cancelled = false;
let restoreNavigate: (() => void) | undefined;

async function redirectToLibraryOnBoot(): Promise<void> {
    while (!cancelled && !(globalThis as { dataRouter?: DataRouterHolder }).dataRouter?.promise) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (cancelled) return;

    const router = await (globalThis as { dataRouter?: DataRouterHolder }).dataRouter!.promise!;
    if (cancelled) return;

    const originalNavigate = router.navigate.bind(router);
    const guardUntil = Date.now() + BOOT_GUARD_MS;

    // Intercept Medal's post-boot redirect to "/" or "/home" during startup
    router.navigate = (to: unknown, options?: { replace?: boolean }) => {
        if (Date.now() < guardUntil) {
            const targetPath =
                typeof to === "string"
                    ? to
                    : typeof to === "object" && to !== null && "pathname" in to
                      ? String((to as { pathname?: unknown }).pathname ?? "")
                      : "";

            if (targetPath === "/" || targetPath === "/home") {
                return originalNavigate("/library", { ...options, replace: true });
            }
        }
        return originalNavigate(to, options);
    };

    restoreNavigate = () => {
        router.navigate = originalNavigate;
    };

    // Navigate immediately if not already on /library
    const currentPath = router.state?.location?.pathname;
    if (currentPath !== "/library") {
        await originalNavigate("/library", { replace: true });
    }

    // Restore unmodified router.navigate after startup completes
    window.setTimeout(() => {
        restoreNavigate?.();
        restoreNavigate = undefined;
    }, BOOT_GUARD_MS);
}

export default definePlugin({
    name: "StartOnClips",
    description: "Opens the Library (/library) page directly on boot instead of the Home page.",
    category: "Experimental",
    enabledByDefault: true,
    start() {
        cancelled = false;
        void redirectToLibraryOnBoot();
    },
    stop() {
        cancelled = true;
        restoreNavigate?.();
        restoreNavigate = undefined;
    }
});