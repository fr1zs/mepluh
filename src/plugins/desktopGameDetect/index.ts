import { definePlugin } from "@shared/plugin";

export default definePlugin({
    name: "DesktopGameDetect",
    description: "Categorizes Screen Recording clips under the running game whenever Medal detects a game alongside desktop capture, and moves the clip into the game's folder.",
    category: "Experimental",
    enabledByDefault: true,
    mainPatches: [
        {
            find: "exportStatsDuration:",
            replacement: [
                {
                    match: /async function (\i)\((\i)\)\{const\{createdAt:(\i)=Date\.now\(\),gameCategoryId:/,
                    replace:
                        'async function $1($2){if($2&&(!$2.gameCategoryId||String($2.gameCategoryId)==="4533"||String($2.gameCategoryId)==="1b7CpvXVSuB")){const _g=($2.gameState?.contexts??(typeof Qi==="function"?Qi()?.contexts:null)??[]).find(c=>c?.type==="CATEGORY"&&c.externalId&&String(c.externalId)!=="4533"&&String(c.externalId)!=="1b7CpvXVSuB");if(_g?.externalId)$2={...$2,gameCategoryId:_g.externalId,captionName:_g.name??$2.captionName}}const{createdAt:$3=Date.now(),gameCategoryId:'
                },
                {
                    match: /(let (\i)=\i,(\i)=\i;)(if\(\2&&(\i)!=="session"\|\|\3\)\{const \i=await \i\(\i\.FileRename\);)/,
                    replace:
                        '$1if(N&&$5!=="session"&&String(r)!=="4533"&&String(r)!=="1b7CpvXVSuB"){try{const _gn=(await gg(r))?.categoryName??s,_dir=ze.default.dirname(N),_base=ze.default.basename(_dir).toLowerCase();if(_gn&&(_base==="screen recording"||_base==="screen capture"||_base==="desktop capture")){const _safe=IG(_gn).trim();if(_safe){const _targetDir=ze.default.join(ze.default.dirname(_dir),_safe);await St.default.mkdir(_targetDir,{recursive:!0});const _dest=await Nl(ze.default.join(_targetDir,ze.default.basename(N)));await St.default.rename(N,_dest);N=_dest;$2&&($2=N);$3&&($3=N)}}}catch{}}$4'
                }
            ]
        }
    ]
});