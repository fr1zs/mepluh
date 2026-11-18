import { definePlugin } from "@shared/plugin";

export default definePlugin({
    name: "DesktopGameDetect",
    description: "Categorizes Screen Recording clips under the running game whenever Medal detects a game alongside desktop capture.",
    category: "Experimental",
    enabledByDefault: true,
    mainPatches: [
        {
            find: "exportStatsDuration:",
            replacement: {
                match: /async function (\i)\((\i)\)\{const\{createdAt:(\i)=Date\.now\(\),gameCategoryId:/,
                replace:
                    'async function $1($2){if($2&&(!$2.gameCategoryId||String($2.gameCategoryId)==="4533"||String($2.gameCategoryId)==="1b7CpvXVSuB")){const _g=($2.gameState?.contexts??(typeof Qi==="function"?Qi()?.contexts:null)??[]).find(c=>c?.type==="CATEGORY"&&c.externalId&&String(c.externalId)!=="4533"&&String(c.externalId)!=="1b7CpvXVSuB");if(_g?.externalId)$2={...$2,gameCategoryId:_g.externalId}}const{createdAt:$3=Date.now(),gameCategoryId:'
            }
        }
    ]
});