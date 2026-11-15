[![Mepluh](assets/banner.svg)](https://github.com/fr1zs/mepluh)

<p align="center"><b>A fix for Mepluh, a mod for Medal</b></p>

<p align="center">
  <a href="#features">Features</a> · <a href="#install">Install</a> · <a href="#plugins">Plugins</a> · <a href="#themes">Themes</a>
</p>

---

![Mepluh settings inside Medal](assets/screenshot.png)

## Features

- 🚫 **No ads.** Every ad slot, sponsored card and promo campaign is gone.
- 🕵️ **No telemetry.** Analytics, session replay and crash reporting are blocked.
- ⚙️ **Native settings.** Mepluh lives inside Medal's own settings, built with Medal's own components.
- 🎨 **Themes.** Catppuccin, Transparency, your own `.css` files or any theme URL, applied live.
- 🫧 **Liquid Glass.** Refractive, light-reactive glass with Windows 11 Acrylic and Mica backdrops.
- ✏️ **Custom CSS.** A built-in Monaco editor with autocomplete and live preview.
- ⏩ **Arrow seeking.** Scrub through clips effortlessly using your keyboard's arrow keys.
- 🔌 **Offline focus.** Strip away social feeds and online clutter, and lock down auto-updates.
- 🎮 **Discord Rich Presence.** Broadcast your Medal activity directly to your Discord profile.
- 🔊 **Unlocked sound alerts.** Access restricted sound alerts right out of the box.

## Install

Requires Windows (CMD no admin), Medal and [Bun](https://bun.sh).

```sh
git clone https://github.com/fr1zs/mepluh
cd mepluh
bun install
bun run inject
```

*OR, if you dont want to use git:*
1. Download the whole .zip file, extract it, and store it somewhere safe.
2. Right-Click inside the folder and "Open in terminal"
3. Run: 
```sh 
bun install
bun run inject 
``` 

Open Medal's settings and look for the **Mepluh** section.

Medal's updater replaces its install folder, so run `bun run inject` again after Medal updates. To remove Mepluh, run `bun run uninject`.

## Plugins

| Plugin | What it does |
| --- | --- |
| NoAds | Removes every ad slot and blocks Medal's ad session. |
| NoPromotions | Removes sponsored cards, promo announcements and campaign banners. |
| NoTelemetry | Blocks Amplitude, session replay, Sentry and LaunchDarkly uploads. |
| WindowEffects | Liquid Glass, Acrylic and Mica window backdrops. |
| CustomCSS | Applies `%APPDATA%\Mepluh\custom.css` live. |
| FeatureFlags | Overrides Medal's feature flags. |
| DevTools | Opens DevTools with F12 or Ctrl+Shift+I. |
| ArrowSeek | Seeks forward and backward in clips using the arrow keys. |
| HideOnlineFeatures | Hides social, feed, and online-only tabs for a local-first experience. |
| NoAutoUpdate | Prevents Medal from automatically downloading and installing updates. |
| RichPresence | Displays your current Medal activity on Discord Rich Presence. |
| Settings | Integrates Mepluh's configuration tab natively into Medal's settings. |
| UnlockSoundAlerts | Unlocks restricted sound alerts and audio effects. |

## Themes

Drop any `.css` file into `%APPDATA%\Mepluh\themes` and enable it under **Mepluh → Themes**. Online themes work too: paste a link.

Built in: **Catppuccin** (Latte, Frappé, Macchiato, Mocha) and **Transparency**. Change the Catppuccin accent with `:root { --ctp-accent: var(--ctp-pink); }` in Custom CSS.

## ORIGINAL PROJECT
https://github.com/prettylittlelies/mepluh
