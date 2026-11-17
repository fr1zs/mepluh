import { app, ipcMain, net, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IpcChannel, type ModLocation, type MonacoAssets, type UpdateResult } from "@shared/ipc";
import type { PatchReport } from "@shared/patchReport";
import type { PluginSettings } from "@shared/settings";
import type { ThemeSettings } from "@shared/themes";
import type { NativeRuntime } from "./nativeRuntime";
import type { ModPaths } from "./paths";
import type { SettingsStore } from "./settingsStore";
import type { ThemeService } from "./themes/themeService";

const GITHUB_COMMIT_API = "https://api.github.com/repos/fr1zs/mepluh/commits/main";
const INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/fr1zs/mepluh/main/install.ps1";

export interface PatchReportSource {
    readonly report: PatchReport;
}

export interface IpcServices {
    readonly paths: ModPaths;
    readonly store: SettingsStore;
    readonly runtime: NativeRuntime;
    readonly patches: PatchReportSource;
    readonly themes: ThemeService;
}

export const registerIpcBridge = ({ paths, store, runtime, patches, themes }: IpcServices): void => {
    const locations: Readonly<Record<ModLocation, string>> = { data: paths.data, customCss: paths.customCss, themes: paths.themes };
    const rendererSource = readFileSync(paths.renderer, "utf8");
    const versionFile = join(paths.data, ".installed-commit");

    ipcMain.on(IpcChannel.RendererSource, event => {
        event.returnValue = rendererSource;
    });

    ipcMain.on(IpcChannel.NativePlugins, event => {
        event.returnValue = runtime.pluginNames;
    });

    ipcMain.on(IpcChannel.SettingsGet, event => {
        event.returnValue = store.current;
    });

    ipcMain.handle(IpcChannel.SettingsSet, (_event, plugin: string, settings: PluginSettings) => store.update(plugin, settings));

    ipcMain.handle(IpcChannel.Relaunch, () => {
        app.relaunch();
        app.exit(0);
    });

    ipcMain.handle(IpcChannel.UpdateMepluh, async (): Promise<UpdateResult> => {
        const res = await net.fetch(GITHUB_COMMIT_API, {
            headers: { "User-Agent": "Mepluh-Updater", Accept: "application/vnd.github+json" }
        });
        if (!res.ok) throw new Error(`GitHub check failed (${res.status})`);

        const data = (await res.json()) as { sha?: string };
        const latestSha = data.sha?.trim();
        if (!latestSha) throw new Error("Unable to read latest version from GitHub");

        const installedSha = existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : "";
        if (installedSha && installedSha === latestSha) {
            return "up-to-date";
        }

        mkdirSync(paths.data, { recursive: true });
        writeFileSync(versionFile, latestSha, "utf8");

        const child = spawn(
            "powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `irm ${INSTALL_SCRIPT_URL} | iex`],
            { detached: true, stdio: "ignore" }
        );
        child.unref();

        setTimeout(() => app.exit(0), 250);
        return "updating";
    });

    ipcMain.handle(IpcChannel.OpenPath, async (_event, location: ModLocation) => {
        const failure = await shell.openPath(locations[location]);
        if (failure) throw new Error(failure);
    });

    ipcMain.handle(IpcChannel.PatchReport, () => patches.report);

    let monaco: Promise<MonacoAssets> | undefined;
    const readMonaco = (file: string): Promise<string> => readFile(join(paths.monaco, file), "utf8");
    ipcMain.handle(IpcChannel.MonacoAssets, () =>
        (monaco ??= Promise.all(["monaco.js", "monaco.css", "editor.worker.js", "css.worker.js"].map(readMonaco)).then(([script = "", css = "", editor = "", cssWorker = ""]) => ({
            script,
            css,
            workers: { editor, css: cssWorker }
        })))
    );

    ipcMain.handle(IpcChannel.ThemesList, () => themes.list());
    ipcMain.handle(IpcChannel.ThemesRead, (_event, id: string) => themes.read(id));
    ipcMain.handle(IpcChannel.ThemesFetch, (_event, link: string) => themes.fetchOnline(link));
    ipcMain.handle(IpcChannel.ThemesSet, (_event, settings: ThemeSettings) => store.updateThemes(settings));

    ipcMain.handle(IpcChannel.PluginInvoke, (_event, plugin: string, handler: string, args: readonly unknown[]) => runtime.invoke(plugin, handler, args));
};