import type { SettingsTabId } from "@shared/settingsTabs";
import { Logger } from "@shared/logger";
import { loadMedalUi } from "../medal/components";
import type { Component } from "../medal/types";
import type { SettingsContext } from "./context";
import { createTabs } from "./tabs";

const log = new Logger("settings-route");

export interface LazyRoute {
    readonly Component: Component<object>;
}

export type SettingsRouteLoader = (tab: SettingsTabId) => Promise<LazyRoute>;

export const createSettingsRouteLoader = (context: SettingsContext): SettingsRouteLoader => {
    const tabs = createTabs(context);
    return async tab => {
        try {
            await loadMedalUi();
            return { Component: tabs[tab] };
        } catch (error) {
            log.error("Could not load Medal's UI. Medal was probably updated; run \"bun run diagnose\".", error);
            const message = error instanceof Error ? error.message : String(error);
            return { Component: () => `Mepluh could not load: ${message}` as unknown as null };
        }
    };
};
