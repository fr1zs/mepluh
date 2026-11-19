import { definePlugin } from "@shared/plugin";

export default definePlugin({
    name: "KeepEditsInGameFolder",
    description: "Keeps trimmed and edited clips in the original clip's game folder instead of moving them to the Edits folder.",
    category: "Experimental",
    enabledByDefault: true,
    mainPatches: [
        {
            find: "trimming video for",
            replacement: {
                match: /(\i=\i\.default\.basename\((\i),\i\)\.replace\(\/-trim-\.\+\$\/i,""\),\i=(\i)\.default\.join\()await \i\("Edits"\)/,
                replace: "$1($2?$3.default.dirname($2):await Fc(\"Edits\"))"
            }
        }
    ]
});