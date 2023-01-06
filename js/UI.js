import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import * as App from './app.js';
import * as Game from './game.js';
import { tryBuildUnit, tryUnlockUnit, tryUpgrade } from "./game.js"
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);
Object.entries(Draw).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

function drawSpriteScreen(sprite, row, col, pos, colorOverlay = null)
{
    const asset = sprite.imgAsset;
    if (asset.loaded) {
        let sourceX = col * sprite.width;
        let sourceY = row * sprite.height;
        let img = asset.img;
        if (colorOverlay != null) {
            img = asset.scratchCanvas;
            const ctx = asset.scratchCtx;
            ctx.clearRect(0, 0, sprite.width, sprite.height);
            ctx.drawImage(
                asset.img,
                sourceX, sourceY,
                sprite.width, sprite.height,
                0,0,
                sprite.width, sprite.height
            );
            ctx.globalCompositeOperation = "source-in";
            ctx.fillStyle = colorOverlay;
            ctx.fillRect(0, 0, sprite.width, sprite.height);
            ctx.globalCompositeOperation = "source-out";
            sourceX = 0;
            sourceY = 0;
        }
        context.imageSmoothingEnabled = false;
        context.drawImage(
            img,
            sourceX, sourceY,
            sprite.width, sprite.height,
            pos.x, pos.y,
            sprite.width, sprite.height);
    } else {
        if (colorOverlay != null) {
            context.fillStyle = colorOverlay;
        }
        fillRectScreen(context, pos, vec(sprite.width, sprite.height), "#000");
    }
}

function drawTextScreen(string, pos, sizePx, fillStyle, stroke=false, align='left', baseline='alphabetic')
{
    if (stroke) {
        strokeTextScreen(context, string, pos, sizePx, 3, 'black', align, baseline);
    }
    fillTextScreen(context, string, pos, sizePx, fillStyle, align, baseline);
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
        if (gameState.mouseEnabled) {
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
    const maxLevel = upgrade.goldCost.length - 1;
    const isMax = level >= maxLevel;
    const cost = isMax ? Infinity : upgrade.goldCost[level + 1];
    const canAfford = player.gold >= cost;
    const canPress = canAfford;
    const buttonFontSz = 20;
    const buttonFont = `${buttonFontSz}px sans-serif`;
    const { press, hover } = canPress && pressedButton(player, pos, dims, key);

    if (press) {
        tryUpgrade(player.id, upgrade.id);
    }

    fillRectScreen(context, pos, dims, hover ? "#888" : "#444", 10);
    // draw sprite
    //const sprite = unitSprites[unit.id];
    //const spriteDrawPos = vecAdd(pos, vecMul(dims, 0.5))
    //vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
    //drawSpriteScreen(sprite, 0, 0, spriteDrawPos, unlocked ? null : "#000");

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
        drawTextScreen(`$${cost}`, costPos, buttonFont, costColor, true);
    }
}

function unitButton(player, pos, dims, key, unit)
{
    const unlocked = player.unitUnlocked[unit.id];
    const cost = unlocked ? unit.goldCost : unit.unlockCost;
    const canAfford = player.gold >= cost;
    const onCd = player.unitCds[unit.id] > 0;
    const canPress = canAfford && !onCd;
    const buttonFontSz = 20;
    const buttonFont = `${buttonFontSz}px sans-serif`;
    const { press, hover } = canPress && pressedButton(player, pos, dims, key);

    if (press) {
        if (unlocked) {
            tryBuildUnit(player.id, unit);
        } else {
            tryUnlockUnit(player.id, unit);
        }
    }

    fillRectScreen(context, pos, dims, hover ? "#888" : "#444", 10);
    // draw sprite
    const sprite = unitSprites[unit.id];
    const spriteDrawPos = vecAdd(pos, vecMul(dims, 0.5))
    vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
    drawSpriteScreen(sprite, 0, 0, spriteDrawPos, unlocked ? null : "#000");

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

    drawTextScreen(`$${cost}`, vec(pos.x + 3,pos.y + dims.y - 5), buttonFont, costColor, true);
}

export function doPlayerUI(player)
{
    // UI layout:
    //  gold
    //  unit buttons
    //  upgrade buttons
    //  lighthouse HP
    const UIInnerpadding = 16;
    const UIOuterPadding = 20;
    const goldFontSz = 30;
    const goldFont = `${goldFontSz}px sans-serif`;
    const goldFontSmol = `20px sans-serif`;
    const goldFontMetrics = getTextDims(context, '$00', goldFont, 'left', 'top');
    const goldHeight = goldFontMetrics.actualHeight;
    const buttonDims = vec(64,64);
    const buttonXGap = UIInnerpadding;
    const numUnitButtons = Object.keys(hotKeys[player.id].units).length;
    const numUpgradeButtons = Object.keys(hotKeys[player.id].upgrades).length;
    const lhHpHeight = 16;
    const lhHpMaxWidth = canvas.width / 3;
    const UIwidth = Math.max(
        lhHpMaxWidth,
        numUnitButtons * buttonDims.x + (numUnitButtons - 1) * buttonXGap,
        numUpgradeButtons * buttonDims.x + (numUpgradeButtons - 1) * buttonXGap,
    ) + UIOuterPadding * 2;
    const UIheight = goldFontSz + 2 * buttonDims.y + lhHpHeight + 3 * UIInnerpadding + 2 * UIOuterPadding;
    const UIstartX = player.id == 0 ? 0 : canvas.width - UIwidth;
    const UIstartY = canvas.height - UIheight;
    //strokeRectScreen(context, vec(UIstartX, UIstartY), vec(UIwidth, UIheight), "red");
    let xOff = UIstartX + UIOuterPadding;
    let yOff = UIstartY + UIOuterPadding;
    //strokeRectScreen(context, vec(xOff, yOff), vec(goldFontMetrics.width, goldHeight), "red");

    // gold
    const goldStart = vec(xOff, yOff);
    const goldText = `$${Math.floor(player.gold)}`;
    drawTextScreen(goldText, goldStart, goldFont, player.color, true, 'left', 'top');
    const gpsText = `(+$${player.goldPerSec.toFixed(2)}/sec)`;
    const gpsStart = vecAdd(goldStart, vec(goldFontMetrics.width + 40, 0));
    drawTextScreen(gpsText, gpsStart, goldFontSmol, player.color, true, 'left', 'top');
    if (debug.drawUI && player.goldDamage > 0) {
        const gdStart = vecAdd(gpsStart, vec(180, 0));
        drawTextScreen(`-$${player.goldDamage.toFixed(2)}`, gdStart, goldFontSmol, player.color, true, 'left', 'top');
    }

    yOff += UIInnerpadding + goldHeight;

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

    xOff = UIstartX + UIOuterPadding;
    yOff += buttonDims.y + UIInnerpadding;

    // lighthouse health bars
    const { unit, hp } = gameState.entities;
    const lighthouseHp = hp[player.island.idx];
    const f = clamp(lighthouseHp / unit[player.island.idx].maxHp, 0, 1);
    const greenWidth = lhHpMaxWidth * f;
    const redStartX = xOff + greenWidth;
    const redWidth = lhHpMaxWidth * (1 - f);
    fillRectScreen(context, vec(xOff, yOff), vec(greenWidth, lhHpHeight), '#00ff00');
    fillRectScreen(context, vec(redStartX, yOff), vec(redWidth, lhHpHeight), '#ff0000');

    // lane indicators and hotkeys
    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
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
}

export function processMouseInput()
{
    // camera
    gameState.camera.scale = clamp(gameState.camera.scale + gameState.input.mouseScrollDelta, 0.1, 5);
    if (gameState.input.mouseMiddle) {
        const delta = vecMul(vecSub(gameState.input.mouseScreenPos, gameState.lastInput.mouseScreenPos), gameState.camera.scale);
        if (vecLen(delta)) {
            vecSubFrom(gameState.camera.pos, delta);
        }
    }
    // select lane
    const localPlayer = getLocalPlayer();
    localPlayer.laneHovered = -1;
    let minLane = 0;
    let minDist = Infinity;
    let minStuff = null;
    for (let i = 0; i < localPlayer.island.lanes.length; ++i) {
        const lane = localPlayer.island.lanes[i];
        const stuff = pointNearLineSegs(gameState.input.mousePos, lane.bridgePoints);
        if (stuff.dist < minDist) {
            minLane = i;
            minDist = stuff.dist;
            minStuff = stuff;
        }
    }
    if (gameState.mouseEnabled) {
        if (minDist < params.laneSelectDist) {
            localPlayer.laneHovered = minLane;
        }
    }
    if (mouseLeftPressed()) {
        if (gameState.mouseEnabled) {
            if (localPlayer.laneHovered >= 0) {
                localPlayer.laneSelected = localPlayer.laneHovered;
            }
        }
        if (debug.enableControls) {
            debug.clickedPoint = vecClone(gameState.input.mousePos);
            debug.closestLanePoint = minStuff.point;
        }
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
