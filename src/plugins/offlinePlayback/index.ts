import { chunkMarker } from "@shared/chunkPatches";
import { definePlugin } from "@shared/plugin";

export default definePlugin({
    name: "OfflinePlayback",
    description: "Fixes local clip playback from disk when offline instead of hanging on remote HLS streams.",
    category: "Core",
    enabledByDefault: true,
    patches: [
        {
            find: chunkMarker("renderer-MedalPlayerSettings"),
            replacement: {
                match: /\(\i\?this\.props\.localFileUrl:void 0\)\|\|this\.props\.content\?\.contentUrlHls\|\|this\.props\.content\?\.contentUrl\|\|""/,
                replace:
                    'this.props.localFileUrl||(this.props.content?.contentUrl?.startsWith("file://")?this.props.content.contentUrl:void 0)||this.props.content?.contentUrlHls||this.props.content?.contentUrl||""'
            }
        },
        {
            find: chunkMarker("renderer-MedalPlayerSettings"),
            replacement: {
                match: /this\.state\.useLocalFile\?this\.updateState\(\{useLocalFile:!1\}/,
                replace: "this.state.useLocalFile&&navigator.onLine?this.updateState({useLocalFile:!1}"
            }
        }
    ]
});