// Checks every Medal chunk/export that Mepluh imports against the Medal build you have installed.
// Usage: bun run diagnose [--medal <Medal root>] [--asar <path to a Medal app asar>]
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listAsarFiles, readAsarFile } from "../src/installer/asar";
import { resolveLocations } from "../src/installer/locations";
import { componentSources, factorySources, toastSource, type Source } from "../src/renderer/medal/components";

const flag = (name: string): string | undefined => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const pickArchive = (): string => {
    const explicit = flag("--asar");
    if (explicit) return explicit;
    const { entry, relocated } = resolveLocations(flag("--medal"));
    // When Mepluh is injected, the real app lives in _app.asar and app.asar is only our stub.
    return existsSync(relocated.archive) ? relocated.archive : entry.archive;
};

interface ExportInfo {
    readonly exported: string;
    readonly local: string;
}

const parseExports = (source: string): ExportInfo[] => {
    const blocks = [...source.matchAll(/export\s*\{([^}]*)\}/g)];
    const infos: ExportInfo[] = [];
    for (const block of blocks) {
        for (const part of (block[1] ?? "").split(",")) {
            const [local, , exported] = part.trim().split(/\s+/);
            if (local) infos.push({ local, exported: exported ?? local });
        }
    }
    return infos;
};

const snippet = (source: string, local: string): string => {
    const escaped = local.replace(/[$]/g, "\\$");
    const match = new RegExp(`(?:function\\s*\\*?\\s*${escaped}\\s*\\(|(?:const|let|var)\\s+${escaped}\\s*=|class\\s+${escaped}\\b)`).exec(source);
    if (!match) return "(definition not found)";
    return source
        .slice(match.index, match.index + 260)
        .replace(/\s+/g, " ")
        .trim();
};

const archive = pickArchive();
console.log(`Reading ${archive}\n`);
const files = await listAsarFiles(archive);
const chunkFiles = files.filter(file => /(^|\/)chunks\/renderer-[^/]+\.js$/.test(file));
console.log(`Found ${chunkFiles.length} renderer chunks inside the archive.\n`);

const byBase = new Map(chunkFiles.map(file => [file.split("/").pop()!.replace(/\.js$/, ""), file]));
const cache = new Map<string, string>();
const load = async (file: string): Promise<string> => {
    const hit = cache.get(file);
    if (hit !== undefined) return hit;
    const text = (await readAsarFile(archive, file)).toString("utf8");
    cache.set(file, text);
    return text;
};

const sources: [string, Source][] = [
    ...Object.entries(factorySources).map(([key, source]) => [key, source] as [string, Source]),
    ["toast", toastSource],
    ...Object.entries(componentSources).map(([key, source]) => [key, source as Source] as [string, Source])
];

const lines: string[] = [];
const emit = (line = ""): void => {
    lines.push(line);
    console.log(line);
};

let broken = 0;
const reportedChunks = new Set<string>();

for (const [label, [chunk, name]] of sources) {
    const file = byBase.get(chunk);
    if (!file) {
        broken++;
        if (reportedChunks.has(chunk)) continue;
        reportedChunks.add(chunk);
        const core = chunk.replace(/^renderer-/, "").replace(/\.\d+$/, "");
        const similar = [...byBase.keys()].filter(base => base.toLowerCase().includes(core.toLowerCase().slice(0, 8)));
        emit(`MISSING CHUNK  ${label}: "${chunk}" does not exist.`);
        emit(`    similar chunk names: ${similar.length ? similar.join(", ") : "(none)"}`);
        continue;
    }
    const source = await load(file);
    const exports = parseExports(source);
    const found = exports.find(info => info.exported === name);
    if (found) continue;
    broken++;
    emit(`MISSING EXPORT ${label}: chunk "${chunk}" has no export "${name}".`);
    if (reportedChunks.has(chunk)) continue;
    reportedChunks.add(chunk);
    emit(`    exports actually present in ${chunk}:`);
    for (const info of exports) emit(`      ${info.exported}  =  ${snippet(source, info.local)}`);
}

emit();
emit(broken === 0 ? "All chunk/export mappings resolve. The crash is likely something else; open Medal, press F12 and send the red console error." : `${broken} mapping(s) are out of date. Send me diagnose-report.txt.`);

const report = join(process.cwd(), "diagnose-report.txt");
await writeFile(report, lines.join("\n"), "utf8");
console.log(`\nReport written to ${report}`);
