import { MOD_NAME } from "@shared/constants";
import type { ChangelogCommit, PendingChangelog } from "@shared/ipc";
import { whenDomReady } from "./domReady";
import { loadMedalUi, medalUi } from "./medal/components";
import { importExport } from "./medal/chunks";

interface ReactDomClient {
    createRoot(container: Element): { render(node: unknown): void; unmount(): void };
}

const formatDate = (iso: string): string => {
    if (!iso) return "";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const FeaturedEntry = ({ commit }: { readonly commit: ChangelogCommit }) => {
    const { Badge } = medalUi().components;
    const dateStr = formatDate(commit.date);
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-primary-700 bg-brand-primary-950 p-5">
            <div className="flex items-center justify-between gap-2">
                <Badge variant="brand">Latest</Badge>
                {dateStr && <span className="text-xs text-foreground-500">{dateStr}</span>}
            </div>
            <span className="text-lg font-bold leading-snug text-foreground-0">{commit.title}</span>
            {commit.body && <span className="whitespace-pre-line text-sm leading-relaxed text-foreground-300">{commit.body}</span>}
        </div>
    );
};

const PastEntry = ({ commit }: { readonly commit: ChangelogCommit }) => {
    const dateStr = formatDate(commit.date);
    return (
        <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-foreground-0">{commit.title}</span>
                {dateStr && <span className="shrink-0 text-xs text-foreground-500">{dateStr}</span>}
            </div>
            {commit.body && <span className="whitespace-pre-line text-xs leading-relaxed text-foreground-300">{commit.body}</span>}
        </div>
    );
};

const ChangelogDialog = ({ changelog, onDone }: { readonly changelog: PendingChangelog; readonly onDone: () => void }) => {
    const { React, components } = medalUi();
    const { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, Button, Badge } = components;
    const [open, setOpen] = React.useState(true);

    const latest = changelog.commits[0];
    const past = changelog.commits.slice(1);
    if (!latest) return null;

    const handleOpenChange = (next: boolean): void => {
        setOpen(next);
        if (!next) window.setTimeout(onDone, 250);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[600px] sm:max-w-[600px]">
                <div className="flex flex-col gap-2 pe-8">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="m-0 text-xl">What&apos;s New in {MOD_NAME}</DialogTitle>
                        <Badge variant="brand">v{MEPLUH_VERSION}</Badge>
                    </div>
                    <DialogDescription>Patch notes from your updates.</DialogDescription>
                </div>

                <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
                    <FeaturedEntry commit={latest} />
                    {past.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground-500">Previous Updates</span>
                            <div className="flex flex-col divide-y divide-stroke-0/16 rounded-lg bg-third-layer px-5 py-4">
                                {past.map((commit, index) => (
                                    <PastEntry key={`${commit.title}-${commit.date}-${index}`} commit={commit} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="brand" size="md" onClick={() => handleOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const mountChangelogDialog = async (changelog: PendingChangelog): Promise<void> => {
    await loadMedalUi();
    const reactDomFactory = (await importExport("renderer-react-dom.production", "t")) as () => ReactDomClient;
    const ReactDOM = reactDomFactory();
    const { runtime } = medalUi();

    const host = document.createElement("div");
    host.id = "mepluh-changelog-host";
    document.body.appendChild(host);

    const root = ReactDOM.createRoot(host);
    const cleanup = (): void => {
        root.unmount();
        host.remove();
    };

    root.render(runtime.jsx(ChangelogDialog, { changelog, onDone: cleanup }));
};

export const checkAndShowPendingChangelog = async (): Promise<void> => {
    const changelog = await MepluhNative.consumeChangelog();
    if (!changelog || changelog.commits.length === 0) return;
    await whenDomReady();
    window.setTimeout(() => {
        void mountChangelogDialog(changelog);
    }, 1000);
};