import type { PluginDefinition } from "@shared/plugin";
import arrowSeek from "./arrowSeek";
import customCss from "./customCss";
import desktopGameDetect from "./desktopGameDetect";
import devTools from "./devTools";
import featureFlags from "./featureFlags";
import hideOnlineFeatures from "./hideOnlineFeatures";
import noAds from "./noAds";
import noAutoUpdate from "./noAutoUpdate";
import noPromotions from "./noPromotions";
import noTelemetry from "./noTelemetry";
import richPresence from "./richPresence";
import settings from "./settings";
import startOnClips from "./startOnClips";
import unlockSoundAlerts from "./unlockSoundAlerts";
import windowEffects from "./windowEffects";

export const plugins: readonly PluginDefinition[] = [
    settings,
    noAds,
    noPromotions,
    hideOnlineFeatures,
    noTelemetry,
    noAutoUpdate,
    featureFlags,
    customCss,
    windowEffects,
    richPresence,
    unlockSoundAlerts,
    arrowSeek,
    desktopGameDetect,
    startOnClips,
    devTools
];