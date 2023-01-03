import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import * as App from './app.js';
import { tryBuildUnit } from "./game.js"
import { strokeTextScreen, strokeTextWorld } from "./draw.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);
Object.entries(Draw).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

function drawSpriteScreen(sprite, row, col, pos)
{
    const asset = sprite.imgAsset;
    if (asset.loaded) {
        const sourceX = col * sprite.width;
        const sourceY = row * sprite.height;
        context.imageSmoothingEnabled = false;
        context.drawImage(
            asset.img,
            sourceX, sourceY,
            sprite.width, sprite.height,
            pos.x, pos.y,
            sprite.width, sprite.height);
    } else {
        fillRectScreen(context, pos, vec(sprite.width, sprite.height), "#000");
    }
}

function drawTextScreen(string, pos, sizePx, fillStyle, stroke=false, align='left')
{
    if (stroke) {
        strokeTextScreen(context, string, pos, sizePx, 3, 'black', align);
    }
    fillTextScreen(context, string, pos, sizePx, fillStyle, align);
}

function drawText(string, worldPos, sizePx, fillStyle, stroke=false, align='center')
{
    if (stroke) {
        strokeTextWorld(context, string, worldPos, sizePx, 3, 'black', align);
    }
    fillTextWorld(context, string, worldPos, sizePx, fillStyle, align);
}

function unitButton(player, pos, dims, key, unit)
{
    let tryBuild = false;
    // process the input first
    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        if (gameState.mouseEnabled) {
            if (pointInAABB(gameState.input.mouseScreenPos, pos, dims)) {
                if (mouseLeftPressed()) {
                    tryBuild = true;
                } else {
                    // hover
                }
            }
        }
        if (keyPressed(key)) {
            tryBuild = true;
        }
    }

    if (tryBuild) {
        tryBuildUnit(player.id, unit);
    }

    context.fillStyle = "#444";
    context.fillRect(pos.x, pos.y, dims.x, dims.y);
    // draw sprite
    const sprite = unitSprites[unit.id];
    const spriteDrawPos = vecAdd(pos, vecMul(dims, 0.5))
    vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
    drawSpriteScreen(sprite, 0, 0, spriteDrawPos);

    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        // hotKey
        drawTextScreen(`[${key}]`, vec(pos.x + dims.x - 5, pos.y + 20), 20, 'white', true, 'right');
    }

    // overlay if can't afford
    let costColor = '#ffdd22';
    if (player.gold < unit.goldCost) {
        context.fillStyle = "rgba(20,20,20,0.6)";
        context.fillRect(pos.x, pos.y, dims.x, dims.y);
        costColor = '#ff7744';
    }
    if (player.unitCds[unit.id] > 0) {
        const f = (player.unitCds[unit.id] / unit.cdTimeMs);
        context.fillStyle = "rgba(20,20,20,0.6)";
        context.fillRect(pos.x, pos.y, dims.x, dims.y * f);
    }
    drawTextScreen(`$${unit.goldCost}`, vec(pos.x,pos.y + dims.y), 20, costColor, true);
}

export function doPlayerUI(player)
{
    const UIwidth = canvas.width/3 + 64; // TODO compute this based on unit hotkeys n stuff - currently based on lighthouse HP bars
    const buttonDims = vec(64,64);
    const UIstartX = player.id == 0 ? 0 : canvas.width - UIwidth;
    const buttonStart = vec(UIstartX + 32, canvas.height-48-buttonDims.y);
    const buttonXGap = 16;
    let xoff = 0;

    // lane hotkeys
    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        for (const [key, laneIdx] of Object.entries(hotKeys[player.id].lanes)) {
            if (keyPressed(key)) {
                player.laneSelected = laneIdx;
            }
        }
    }

    // unit buttons and hotkeys
    for (const [key, unit] of Object.entries(hotKeys[player.id].units)) {
        const pos = vec(
            buttonStart.x + xoff,
            buttonStart.y
        );
        unitButton(player, pos, buttonDims, key, unit);
        xoff += buttonDims.x + buttonXGap;
    }

    // gold
    const goldStart = vec(UIstartX + 32, canvas.height-32-buttonDims.y-32);
    drawTextScreen(`$${Math.floor(player.gold)}`, goldStart, 30, player.color, true);

    // lane indicators and hotkeys
    for (const [key, laneIdx] of Object.entries(hotKeys[player.id].lanes)) {
        const lane = player.island.lanes[laneIdx];
        const pos = lane.bridgePoints[0];
        if (player.laneSelected == laneIdx) {
            const dir = vecSub(lane.bridgePoints[1], pos);
            fillTriangleWorld(context, pos, vecToAngle(dir), 15, 20, player.color);
        } else {
            // TODO maybe take away this scale hack and just let it scale
            drawText(`[${key}]`, pos, 20 * gameState.camera.scale, 'white', true);
        }
    }

    // lighthouse health bars
    const { unit, hp } = gameState.entities;
    const lighthouseHp = hp[player.island.idx];
    const f = lighthouseHp / unit[player.island.idx].maxHp;
    const maxWidth = canvas.width / 3;
    const barStartX = UIstartX + 32;
    const barY = canvas.height - 32;
    const greenWidth = maxWidth * f;
    const redStartX = barStartX + greenWidth;
    const redWidth = maxWidth * (1 - f);
    fillRectScreen(context, vec(barStartX, barY), vec(greenWidth, 16), '#00ff00');
    fillRectScreen(context, vec(redStartX, barY), vec(redWidth, 16), '#ff0000');
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
    for (let i = 0; i < gameState.lanes.length; ++i) {
        const lane = gameState.lanes[i].playerLanes[0];
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
        fn: () => {App.gameOver(getLocalPlayer().name, params.playerColors[0])},
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
