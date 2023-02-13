import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import * as App from './app.js';
import * as Game from './game.js';
import { assets } from './assets.js';
import { tryBuildUnit, tryUnlockUnit, tryUpgrade } from "./game.js"
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);
Object.entries(Draw).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

function drawTextScreen(string, pos, font, fillStyle, stroke=false, align='left', baseline='alphabetic')
{
    if (stroke) {
        strokeTextScreen(context, string, pos, font, 3, 'black', align, baseline);
    }
    fillTextScreen(context, string, pos, font, fillStyle, align, baseline);
}

function drawText(string, worldPos, sizePx, fillStyle, stroke=false, align='center')
{
    if (stroke) {
        strokeTextWorld(context, string, worldPos, sizePx, 3, 'black', align);
    }
    fillTextWorld(context, string, worldPos, sizePx, fillStyle, align);
}

function pressedButton(player, pos, dims, key)
{
    let hover = false;
    let press = false;
    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        if (player.mouseEnabled) {
            if (pointInAABB(gameState.input.mouseScreenPos, pos, dims)) {
                if (mouseLeftPressed()) {
                    press = true;
                } else {
                    hover = true;
                }
            }
        }
        if (keyPressed(key)) {
            press = true;
        }
    }
    return { press, hover };
}

function upgradeButton(player, pos, dims, key, upgrade)
{
    const level = player.upgradeLevels[upgrade.id];
    const maxLevel = upgrade.soulsCost.length - 1;
    const isMax = level >= maxLevel;
    const cost = isMax ? Infinity : upgrade.soulsCost[level + 1];
    const canAfford = player.souls >= cost;
    const canPress = canAfford;
    const buttonFontSz = 20;
    const buttonFont = `${buttonFontSz}px sans-serif`;
    const { press, hover } = canPress && pressedButton(player, pos, dims, key);

    if (press) {
        tryUpgrade(player.id, upgrade.id);
    }

    fillRectScreen(context, pos, dims, hover ? "#888" : "#444", 10);
    const ecoText = {
        [UPGRADE.TOWER]: 'PEW',
        [UPGRADE.ECO]: '$$$',
        [UPGRADE.ATK]: 'ATK',
        [UPGRADE.DEF]: 'DEF',
    }
    if (upgrade.imgName) {
        const asset = assets.images[upgrade.imgName];
        const imgDims = vec(asset.width, asset.height);
        const drawPosOff = vecMul(vecSub(dims, imgDims), 0.5);
        const drawPos = vecAdd(pos, drawPosOff);
        drawImageScreen(context, asset.img, drawPos, imgDims);
    } else {
        drawTextScreen(ecoText[upgrade.id], vecAdd(pos, vec(dims.x/2, dims.y/2)), buttonFont, 'lightgray', false, 'center', 'middle');
    }

    const costPos = vec(pos.x + 3,pos.y + dims.y - 5);
    if (isMax) {
        drawTextScreen('max', costPos, buttonFont, "#44ccff", true);
    } else {
        if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
            // hotKey
            drawTextScreen(`[${key}]`, vec(pos.x + dims.x - 5, pos.y + 20), buttonFont, 'white', true, 'right');
        }
        let costColor = '#ffdd22';
        if (!canAfford) {
            const overlayColor = "rgba(20,20,20,0.6)";
            fillRectScreen(context, pos, dims, overlayColor, 10);
            costColor = '#ff7744';
        }
        drawTextScreen(`${cost}`, costPos, buttonFont, params.soulsTextColor, true);
    }
}

function unitButton(player, pos, dims, key, unit)
{
    const unlocked = player.unitUnlocked[unit.id];
    const cost = unlocked ? unit.cost : unit.unlockCost;
    const canAfford = unlocked ? player.gold >= cost : player.souls >= cost;
    const onCd = player.unitCds[unit.id] > 0;
    const canPress = canAfford && !onCd;
    const buttonFontSz = 20;
    const buttonFont = `${buttonFontSz}px sans-serif`;
    const { press, hover } = canPress && pressedButton(player, pos, dims, key);
    let selected = player.unitSelected == unit.id;

    if (press) {
        if (unlocked) {
            if (player.mouseEnabled) {
                if (selected) {
                    player.unitSelected = -1;
                    selected = false;
                } else {
                    player.unitSelected = unit.id;
                    selected = true;
                }
            } else {
                tryBuildUnit(player.id, unit);
            }
        } else {
            tryUnlockUnit(player.id, unit);
        }
    }
    let backColor = "#444";
    if (selected) {
        backColor = "#bbb";
    } else if (hover) {
        backColor = "#888";
    }

    fillRectScreen(context, pos, dims, backColor, 10);
    // draw sprite
    const sprite = unitSprites[unit.id];
    const spriteDrawPos = vecAdd(pos, vecMul(dims, 0.5))
    vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
    drawSpriteScreen(context, sprite, 0, 0, spriteDrawPos, unlocked ? null : "#000");

    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        // hotKey
        drawTextScreen(`[${key}]`, vec(pos.x + dims.x - 5, pos.y + 20), buttonFont, 'white', true, 'right');
    }

    if (onCd) {
        const f = (player.unitCds[unit.id] / unit.cdTimeMs);
        const overlayColor = "rgba(20,20,20,0.6)";
        const overlayDims = vec(dims.x, dims.y * f);
        fillRectScreen(context, pos, overlayDims, overlayColor, 10);
    }

    let costColor = '#ffdd22';
    if (!canAfford) {
        const overlayColor = "rgba(20,20,20,0.6)";
        fillRectScreen(context, pos, dims, overlayColor, 10);
        costColor = '#ff7744';
    }

    let costText = `$${cost}`;
    if (!unlocked) {
        costColor = params.soulsTextColor;
        costText = `${cost}`;
    }
    drawTextScreen(costText, vec(pos.x + 3,pos.y + dims.y - 5), buttonFont, costColor, true);
}

export function doPlayerUI(player)
{
    // UI layout:
    //  gold
    //  souls
    //  unit buttons
    //  upgrade buttons
    const UIInnerpadding = 16;
    const UIOuterPadding = 32;
    const goldFontSz = 30;
    const goldFont = `${goldFontSz}px sans-serif`;
    const goldFontSmol = `20px sans-serif`;
    const goldFontMetrics = getTextDims(context, '$00', goldFont, 'left', 'top');
    const goldColor = params.goldTextColor;
    const goldHeight = goldFontMetrics.actualHeight;
    const soulsHeight = goldHeight;
    const buttonDims = vec(64,64);
    const buttonXGap = UIInnerpadding;
    const numUnitButtons = Object.keys(hotKeys[player.id].units).length;
    const numUpgradeButtons = Object.keys(hotKeys[player.id].upgrades).length;
    const energyHeight = 8;
    const UIwidth = Math.max(
        numUnitButtons * buttonDims.x + (numUnitButtons - 1) * buttonXGap,
        numUpgradeButtons * buttonDims.x + (numUpgradeButtons - 1) * buttonXGap,
    ) + UIOuterPadding * 2;
    const UIheight =
        UIOuterPadding +
        goldHeight +
        UIInnerpadding +
        soulsHeight +
        UIInnerpadding +
        buttonDims.y +
        UIInnerpadding +
        buttonDims.y +
        UIOuterPadding;
    const UIstartX = player.id == 0 ? 0 : canvas.width - UIwidth;
    const UIstartY = canvas.height - UIheight;
    //strokeRectScreen(context, vec(UIstartX, UIstartY), vec(UIwidth, UIheight), "red");
    let xOff = UIstartX + UIOuterPadding;
    let yOff = UIstartY + UIOuterPadding;
    //strokeRectScreen(context, vec(xOff, yOff), vec(goldFontMetrics.width, goldHeight), "red");

    // gold
    const goldStart = vec(xOff, yOff);
    const goldText = `$${Math.floor(player.gold)}`;
    drawTextScreen(goldText, goldStart, goldFont, goldColor, true, 'left', 'top');
    const gpsText = `(+$${player.goldPerSec.toFixed(2)}/sec)`;
    const gpsStart = vecAdd(goldStart, vec(goldFontMetrics.width + 40, 0));
    drawTextScreen(gpsText, gpsStart, goldFontSmol, goldColor, true, 'left', 'top');

    yOff += UIInnerpadding + goldHeight;

    // souls
    const soulsStart = vec(xOff, yOff);
    const soulsText = `${player.souls}`;
    drawTextScreen(soulsText, soulsStart, goldFont, params.soulsTextColor, true, 'left', 'top');

    // gold + souls income
    if (debug.drawUI) {
        const strPos = vecAdd(gpsStart, vec(180, 0));
        const lineOffset = vec(0, 30);
        let str = ''
        str += `base:        $${player.goldBaseEarned.toFixed(2)}\n`;
        str += `dreamers:    $${player.goldFromDreamers.toFixed(2)}\n`;
        str += `totalEarned: $${player.goldEarned.toFixed(2)}\n`;
        for (const s of str.split('\n')) {
            drawTextScreen(s, strPos, goldFontSmol, goldColor, true, 'left', 'top');
            vecAddTo(strPos, lineOffset);
        }
        str = ''
        str += `lighthouse hit:  ${player.soulsFromLighthouse}\n`;
        str += `units killed:    ${player.soulsFromUnitsKilled}\n`;
        for (const s of str.split('\n')) {
            drawTextScreen(s, strPos, goldFontSmol, params.soulsTextColor, true, 'left', 'top');
            vecAddTo(strPos, lineOffset);
        }
    }

    yOff += UIInnerpadding + soulsHeight;

    // unit buttons and hotkeys
    for (const [key, unitId] of Object.entries(hotKeys[player.id].units)) {
        unitButton(player, vec(xOff, yOff), buttonDims, key, units[unitId]);
        xOff += buttonDims.x + buttonXGap;
    }

    xOff = UIstartX + UIOuterPadding;
    yOff += buttonDims.y + UIInnerpadding;

    // upgrade buttons and hotkeys
    for (const [key, upgradeId] of Object.entries(hotKeys[player.id].upgrades)) {
        upgradeButton(player, vec(xOff, yOff), buttonDims, key, upgrades[upgradeId]);
        xOff += buttonDims.x + buttonXGap;
    }

    // lane indicators and keys, for non-mouse control
    if (!player.mouseEnabled && player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        for (const [key, laneIdx] of Object.entries(hotKeys[player.id].lanes)) {
            const lane = player.island.lanes[laneIdx];
            const pos = lane.bridgePoints[0];
            if (keyPressed(key)) {
                player.laneSelected = laneIdx;
            }
            if (player.laneSelected == laneIdx) {
                const dir = vecSub(lane.bridgePoints[1], pos);
                fillTriangleWorld(context, pos, vecToAngle(dir), 15, 20, player.color);
            } else {
                // TODO maybe take away this scale hack and just let it scale
                drawText(`[${key}]`, pos, 20 * gameState.camera.scale, 'white', true);
            }
        }
    }

    // dreamer debug earned gold
    if (debug.drawUI) {
        for (let i = 0; i < gameState.bridges.length; ++i) {
            const bridge = gameState.bridges[i];
            const dreamer = bridge.dreamer;
            if (dreamer.goldEarned == 0) {
                continue;
            }
            const pos = vecAdd(bridge.middlePos, vec(0, -params.laneWidth*2));
            drawText(`+$${dreamer.goldEarned.toFixed(2)}`, pos, 20 * gameState.camera.scale, dreamer.color, true, 'center');
        }
    }
}

export function processMouseInput()
{
    // camera
    const mouseScrollDelta = gameState.input.mouseScrollDelta;
    if (mouseScrollDelta != 0) {
        const scaleDir = mouseScrollDelta > 0 ? 1 : -1;
        const scaleIdx = clamp(gameState.camera.currScaleIdx + scaleDir, 0, gameState.camera.scaleFactors.length - 1);
        gameState.camera.currScaleIdx = scaleIdx;
        gameState.camera.scale = gameState.camera.scaleFactors[scaleIdx];
    }
    if (gameState.input.mouseMiddle) {
        const delta = vecMul(vecSub(gameState.input.mouseScreenPos, gameState.lastInput.mouseScreenPos), gameState.camera.scale);
        if (vecLen(delta)) {
            vecSubFrom(gameState.camera.pos, delta);
        }
    }
    // hover on spawn pos, show unit icon
    const localPlayer = getLocalPlayer();
    localPlayer.laneSpawnHovered = -1;
    let minLane = 0;
    let minDist = Infinity;
    for (let i = 0; i < localPlayer.island.lanes.length; ++i) {
        const spawnPos = localPlayer.island.lanes[i].spawnPos;
        const dist = vecLen(vecSub(gameState.input.mousePos, spawnPos));
        if (dist < minDist) {
            minLane = i;
            minDist = dist;
        }
    }
    if (localPlayer.mouseEnabled) {
        if (minDist < params.spawnPlatRadius) {
            localPlayer.laneSpawnHovered = minLane;
        }
    }
    if (mouseLeftPressed()) {
        if (localPlayer.mouseEnabled) {
            if (localPlayer.unitSelected >= 0 && localPlayer.laneSpawnHovered >= 0) {
                tryBuildUnit(localPlayer.id, units[localPlayer.unitSelected], localPlayer.laneSpawnHovered, gameState.input.mousePos);
            }
        }
        if (debug.enableControls) {
            debug.clickedPoint = vecClone(gameState.input.mousePos);
        }
    } else if (mouseRightPressed()) {
        localPlayer.unitSelected = -1;
    }
}

const debugHotKeys = [
    // TODO this will mess up ticksMs if we ever use it for anything, so don't for now
    {
        key: '`',
        fn: () => {debug.paused = !debug.paused},
        text: 'debug pause',
    }, {
        key: '.',
        fn: () => { debug.frameAdvance = true; },
        text: 'advance 1 frame (while paused)',
    }, {
        key: ',',
        fn: () => {Game.endCurrentGame(getLocalPlayer());},
        text: 'end game',
    }, {
        key: 'n',
        fn: () => {gameState.players[0].gold += 100},
        text: '+100 gold to player 0',
    }, {
        key: 'm',
        fn: () => {gameState.players[1].gold += 100},
        text: '+100 gold to player 1',
    }, {
        key: 'j',
        fn: () => {gameState.players[0].souls += 10},
        text: '+10 souls to player 0',
    }, {
        key: 'k',
        fn: () => {gameState.players[1].souls += 10},
        text: '+10 souls to player 1',
    },
];

const debugFont = '20px sans-serif';
function drawDebugTextScreen(string, pos, align='left')
{
    strokeTextScreen(context, string, pos, debugFont, 3, 'black', align);
    fillTextScreen(context, string, pos, debugFont, 'white', align);
}

export function debugUI(timeDeltaMs)
{
    if (!debug.drawUI) {
        return;
    }

    if (debug.enableControls) {
        for (const { key, fn } of debugHotKeys) {
            if (keyPressed(key)) {
                fn();
                break;
            }
        }
    }

    if (debug.drawClickBridgeDebugArrow) {
        drawArrow(
            debug.closestLanePoint,
            debug.clickedPoint,
            1,
            "#ff0000"
        );
    }
    // compute fps and updates
    debug.fpsTime += timeDeltaMs;
    debug.fpsCounter++;
    if (debug.fpsTime >= 1000) {
        debug.fps = 1000*debug.fpsCounter/debug.fpsTime;
        debug.avgUpdates = debug.numUpdates/debug.fpsCounter;
        debug.fpsTime = 0;
        debug.fpsCounter = 0;
        debug.numUpdates = 0;
    }
    drawDebugTextScreen(`debug mode [${debug.paused ? 'paused' : 'running'}]`, vec(10,20));
    let yoff = 45;
    for (const { key, text } of debugHotKeys) {
        drawDebugTextScreen(` '${key}'  ${text}`, vec(10,yoff));
        yoff += 25;
    }
    if (debug.drawFPS) {
        const fpsStr = `FPS: ${Number(debug.fps).toFixed(2)}`;
        drawDebugTextScreen(fpsStr, vec(canvas.width - 10,20), 20, 'right');
    }
    if (debug.drawNumUpdates) {
        const updatesStr= `updates/frame: ${Number(debug.avgUpdates).toFixed(2)}`;
        drawDebugTextScreen(updatesStr, vec(canvas.width - 10,40), 'right');
    }
    if (debug.drawSoul) {
        const { pos } = gameState.entities;
        for (const player of gameState.players) {
            Draw.fillCircleWorld(context, pos[player.island.idx], params.soulCollectionRadius, '#f0f8');
        }
    }
}

export function getCanvas()
{
    return canvas;
}

export function startFrame()
{
    context.clearRect(0, 0, canvas.width, canvas.height);
}

export function updateDims(width, height)
{
    canvas.width = width;
    canvas.height = height;
}

export function init()
{
    canvas = new OffscreenCanvas(1,1);
    context = canvas.getContext("2d");
}
