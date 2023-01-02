import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import { debugHotKeys } from "./game.js"
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
        context.fillStyle = "#000";
        context.fillRect(pos, sprite.width, sprite.height);
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
    context.fillStyle = "#444";
    context.fillRect(pos.x, pos.y, dims.x, dims.y);
    // draw sprite
    const sprite = unitSprites[unit.id];
    const spriteDrawPos = vecAdd(pos, vecMul(dims, 0.5))
    vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
    drawSpriteScreen(sprite, 0, 0, spriteDrawPos);
    // hotKey
    if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
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

function doPlayerUI(player)
{
    const UIwidth = canvas.width/3 + 64; // TODO compute this based on unit hotkeys n stuff - currently based on lighthouse HP bars
    const buttonDims = vec(64,64);
    const UIstartX = player.id == 0 ? 0 : canvas.width - UIwidth;
    const buttonStart = vec(UIstartX + 32, canvas.height-48-buttonDims.y);
    const buttonXGap = 16;
    let xoff = 0;
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

export function doUI()
{
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < gameState.players.length; ++i) {
        const player = gameState.players[i];
        doPlayerUI(player);
    }
}

export function getCanvas()
{
    return canvas;
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
