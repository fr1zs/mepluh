import { app, ipcMain, net, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
const REPO_ZIP_URL = "https://github.com/fr1zs/mepluh/archive/refs/heads/main.zip";

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

        const medalExe = process.execPath;
        const updaterScript = join(tmpdir(), "mepluh-updater.ps1");
        const scriptContent = [
            `$ErrorActionPreference = "Stop"`,
            `Write-Host "Waiting for Medal to close..." -ForegroundColor Cyan`,
            `Start-Sleep -Seconds 2`,
            `Stop-Process -Name "Medal" -Force -ErrorAction SilentlyContinue`,
            `Start-Sleep -Seconds 1`,
            `$env:Path += ";$env:USERPROFILE\\.bun\\bin"`,
            `if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {`,
            `    Write-Host "Installing Bun..." -ForegroundColor Cyan`,
            `    $bunInstall = Join-Path $env:TEMP "bun-install.ps1"`,
            `    Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile $bunInstall`,
            `    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bunInstall`,
            `    Remove-Item $bunInstall -Force -ErrorAction SilentlyContinue`,
            `    $env:Path += ";$env:USERPROFILE\\.bun\\bin"`,
            `}`,
            `$dir = "$env:USERPROFILE\\mepluh"`,
            `$zip = "$env:TEMP\\mepluh.zip"`,
            `$extractTemp = "$env:TEMP\\mepluh-extract"`,
            `Write-Host "Downloading latest Mepluh update..." -ForegroundColor Cyan`,
            `Invoke-WebRequest -Uri "${REPO_ZIP_URL}" -OutFile $zip`,
            `Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue`,
            `Expand-Archive -Path $zip -DestinationPath $extractTemp -Force`,
            `New-Item -ItemType Directory -Path $dir -Force | Out-Null`,
            `Copy-Item -Path "$extractTemp\\mepluh-main\\*" -Destination $dir -Recurse -Force`,
            `Remove-Item $zip, $extractTemp -Recurse -Force -ErrorAction SilentlyContinue`,
            `Set-Location $dir`,
            `Write-Host "Installing dependencies and patching Medal..." -ForegroundColor Cyan`,
            `bun install --no-progress`,
            `bun run inject`,
            `New-Item -ItemType Directory -Path "${paths.data.replace(/\\/g, "\\\\")}" -Force | Out-Null`,
            `Set-Content -Path "${versionFile.replace(/\\/g, "\\\\")}" -Value "${latestSha}" -NoNewline`,
            `Write-Host "Update complete! Relaunching Medal..." -ForegroundColor Green`,
            `Start-Process "explorer.exe" -ArgumentList '"${medalExe.replace(/\\/g, "\\\\")}"'`,
            `Start-Sleep -Seconds 1`,
            `exit 0`
        ].join("\r\n");

        writeFileSync(updaterScript, scriptContent, "utf8");

        const child = spawn(
            "cmd.exe",
            ["/c", "start", '"Mepluh Updater"', "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", updaterScript],
            { detached: true, stdio: "ignore", windowsVerbatimArguments: true }
        );
        child.unref();

        setTimeout(() => app.exit(0), 300);
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