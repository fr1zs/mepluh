import { app, BrowserWindow, ipcMain, net, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    IpcChannel,
    type ChangelogCommit,
    type ModLocation,
    type MonacoAssets,
    type PendingChangelog,
    type UpdateResult
} from "@shared/ipc";
import type { PatchReport } from "@shared/patchReport";
import type { PluginSettings } from "@shared/settings";
import type { ThemeSettings } from "@shared/themes";
import type { NativeRuntime } from "./nativeRuntime";
import type { ModPaths } from "./paths";
import type { SettingsStore } from "./settingsStore";
import type { ThemeService } from "./themes/themeService";

const GITHUB_COMMIT_API = "https://api.github.com/repos/fr1zs/mepluh/commits/main";
const GITHUB_REPO_API = "https://api.github.com/repos/fr1zs/mepluh";
const REPO_ZIP_URL = "https://github.com/fr1zs/mepluh/archive/refs/heads/main.zip";
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

interface GitHubCommitItem {
    readonly commit?: {
        readonly message?: string;
        readonly author?: {
            readonly date?: string;
        };
    };
}

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

const parseGitHubCommit = (item: GitHubCommitItem): ChangelogCommit | null => {
    const rawMessage = item.commit?.message?.trim() ?? "";
    if (!rawMessage) return null;

    const lines = rawMessage.split(/\r?\n/);
    const title = (lines[0] ?? "").trim();
    const body = lines.slice(1).join("\n").trim();
    const date = item.commit?.author?.date ?? "";

    return { title, body, date };
};

const fetchAllCommitsUpTo = async (toSha: string): Promise<readonly ChangelogCommit[]> => {
    const headers = { "User-Agent": "Mepluh-Updater", Accept: "application/vnd.github+json" };
    const all: ChangelogCommit[] = [];

    for (let page = 1; page <= 10; page++) {
        try {
            const res = await net.fetch(`${GITHUB_REPO_API}/commits?sha=${toSha}&per_page=100&page=${page}`, { headers });
            if (!res.ok) break;
            const listData = (await res.json()) as readonly GitHubCommitItem[];
            if (!Array.isArray(listData) || listData.length === 0) break;

            for (const item of listData) {
                const parsed = parseGitHubCommit(item);
                if (parsed) all.push(parsed);
            }

            if (listData.length < 100) break;
        } catch {
            break;
        }
    }

    return all;
};

export const registerIpcBridge = ({ paths, store, runtime, patches, themes }: IpcServices): void => {
    const locations: Readonly<Record<ModLocation, string>> = { data: paths.data, customCss: paths.customCss, themes: paths.themes };
    const rendererSource = readFileSync(paths.renderer, "utf8");
    const versionFile = join(paths.data, ".installed-commit");
    const availableFile = join(paths.data, ".available-commit");
    const lastCheckFile = join(paths.data, ".last-update-check");
    const pendingChangelogFile = join(paths.data, ".pending-changelog.json");

    const broadcastUpdateAvailable = (available: boolean): void => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                win.webContents.send(IpcChannel.UpdateAvailableChanged, available);
            }
        }
    };

    const readUpdateAvailable = (): boolean => {
        if (!existsSync(availableFile)) return false;
        const availableSha = readFileSync(availableFile, "utf8").trim();
        const installedSha = existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : "";
        if (availableSha && availableSha !== installedSha) return true;
        try {
            unlinkSync(availableFile);
        } catch {}
        return false;
    };

    const checkForUpdates = async (): Promise<{ status: "up-to-date" | "available"; latestSha: string }> => {
        const res = await net.fetch(GITHUB_COMMIT_API, {
            headers: { "User-Agent": "Mepluh-Updater", Accept: "application/vnd.github+json" }
        });
        if (!res.ok) throw new Error(`GitHub check failed (${res.status})`);

        const data = (await res.json()) as { sha?: string };
        const latestSha = data.sha?.trim();
        if (!latestSha) throw new Error("Unable to read latest version from GitHub");

        mkdirSync(paths.data, { recursive: true });
        writeFileSync(lastCheckFile, String(Date.now()), "utf8");

        const wasAvailable = readUpdateAvailable();
        const installedSha = existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : "";

        if (installedSha && installedSha === latestSha) {
            if (existsSync(availableFile)) {
                try {
                    unlinkSync(availableFile);
                } catch {}
            }
            if (wasAvailable) broadcastUpdateAvailable(false);
            return { status: "up-to-date", latestSha };
        }

        writeFileSync(availableFile, latestSha, "utf8");
        if (!wasAvailable) broadcastUpdateAvailable(true);
        return { status: "available", latestSha };
    };

    const runScheduledUpdateCheck = async (): Promise<void> => {
        try {
            if (existsSync(lastCheckFile)) {
                const lastCheck = Number(readFileSync(lastCheckFile, "utf8").trim());
                if (Number.isFinite(lastCheck) && Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) {
                    return;
                }
            }
            await checkForUpdates();
        } catch {}
    };

    const startupCheckTimer = setTimeout(() => {
        void runScheduledUpdateCheck();
    }, 10_000);
    startupCheckTimer.unref?.();

    const periodicCheckTimer = setInterval(() => {
        void checkForUpdates().catch(() => {});
    }, UPDATE_CHECK_INTERVAL_MS);
    periodicCheckTimer.unref?.();

    ipcMain.on(IpcChannel.RendererSource, event => {
        event.returnValue = rendererSource;
    });

    ipcMain.on(IpcChannel.NativePlugins, event => {
        event.returnValue = runtime.pluginNames;
    });

    ipcMain.on(IpcChannel.SettingsGet, event => {
        event.returnValue = store.current;
    });

    ipcMain.on(IpcChannel.UpdateAvailableGet, event => {
        event.returnValue = readUpdateAvailable();
    });

    ipcMain.handle(IpcChannel.GetPendingChangelog, (): PendingChangelog | null => {
        if (!existsSync(pendingChangelogFile)) return null;
        try {
            const raw = readFileSync(pendingChangelogFile, "utf8");
            const parsed = JSON.parse(raw) as PendingChangelog;
            return Array.isArray(parsed.commits) && parsed.commits.length > 0 ? parsed : null;
        } catch {
            return null;
        }
    });

    ipcMain.handle(IpcChannel.DismissPendingChangelog, (): void => {
        try {
            if (existsSync(pendingChangelogFile)) unlinkSync(pendingChangelogFile);
        } catch {}
    });

    ipcMain.handle(IpcChannel.SettingsSet, (_event, plugin: string, settings: PluginSettings) => store.update(plugin, settings));

    ipcMain.handle(IpcChannel.Relaunch, () => {
        app.relaunch();
        app.exit(0);
    });

    ipcMain.handle(IpcChannel.UpdateMepluh, async (_event, install = false): Promise<UpdateResult> => {
        const { status, latestSha } = await checkForUpdates();
        if (status === "up-to-date") return "up-to-date";
        if (!install) return "available";

        const commits = await fetchAllCommitsUpTo(latestSha);
        if (commits.length > 0) {
            mkdirSync(paths.data, { recursive: true });
            const payload: PendingChangelog = { commits };
            writeFileSync(pendingChangelogFile, JSON.stringify(payload), "utf8");
        }

        const medalExe = process.execPath;
        const squirrelUpdater = join(medalExe, "..", "..", "Update.exe");
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
            `Remove-Item -Path "${availableFile.replace(/\\/g, "\\\\")}" -Force -ErrorAction SilentlyContinue`,
            `Write-Host "Update complete! Relaunching Medal..." -ForegroundColor Green`,
            `$launchCmd = if (Test-Path "${squirrelUpdater.replace(/\\/g, "\\\\")}") {`,
            `    '"${squirrelUpdater.replace(/\\/g, "\\\\")}" --processStart Medal.exe'`,
            `} else {`,
            `    '"${medalExe.replace(/\\/g, "\\\\")}"'`,
            `}`,
            `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $launchCmd } | Out-Null`,
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