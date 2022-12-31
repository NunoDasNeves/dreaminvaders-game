import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as App from './app.js';
import { assets } from "./assets.js";
import { debugHotKeys } from "./game.js"
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

/* Add to position to draw sprite centered */
function getDrawUnitPos(pos, width, height, centerOffset)
{
    return vecSub(pos, vecAddTo(vec(width*0.5, height*0.5), centerOffset));
}

function drawImage(imgAsset, pos)
{
    const drawWidth = imgAsset.width / gameState.camera.scale;
    const drawHeight = imgAsset.height / gameState.camera.scale;
    const drawPos = worldToCamera(pos.x, pos.y);

    if (imgAsset.loaded) {
        context.imageSmoothingEnabled = false;
        context.drawImage(imgAsset.img, drawPos.x, drawPos.y, drawWidth, drawHeight);
    } else {
        fillRectangleScreen(drawPos, drawWidth, drawHeight, "#000000");
    }
}

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
        fillRectangleScreen(pos, sprite.width, sprite.height, "#000000");
    }
}

function drawSprite(sprite, row, col, pos)
{
    const asset = sprite.imgAsset;
    const drawWidth = sprite.width / gameState.camera.scale;
    const drawHeight = sprite.height / gameState.camera.scale;
    const drawPos = worldToCamera(pos.x, pos.y);

    if (asset.loaded) {
        const sourceX = col * sprite.width;
        const sourceY = row * sprite.height;
        context.imageSmoothingEnabled = false;
        context.drawImage(
            asset.img,
            sourceX, sourceY,
            sprite.width, sprite.height,
            drawPos.x, drawPos.y,
            drawWidth, drawHeight);
    } else {
        fillRectangleScreen(drawPos, drawWidth, drawHeight, "#000000");
    }
}

function makeOffscreenCanvas(width, height)
{
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext("2d");
    return [c, ctx];
}

function drawSpriteWithOverlay(sprite, row, col, pos, colorOverlay)
{
    // TODO
    drawSprite(sprite, row, col, pos);
}

function drawUnitAnim(i, alpha, colorOverlay)
{
    const { team, playerId, unit, pos, angle, animState } = gameState.entities;
    const { anim, frame, timer, loop } = animState[i];
    let flip = false;
    if (vecFromAngle(angle[i]).x < 0) {
        flip = true;
    }
    const sprite = unitSprites[unit[i].id];
    const animObj = sprite.anims[anim];
    const col = animObj.col + frame;
    const flipOffset = flip ? sprite.rows : 0;
    let colorOffset = 0;
    if (sprite.playerColors) {
        colorOffset = sprite.rows * 2 * gameState.players[playerId[i]].colorIdx;
    }
    const row = animObj.row + flipOffset + colorOffset;
    const drawUnitPos = getDrawUnitPos(pos[i], sprite.width, sprite.height, sprite.centerOffset);
    context.globalAlpha = alpha;
    if (colorOverlay != null) {
        drawSpriteWithOverlay(sprite, row, col, drawUnitPos, colorOverlay);
    } else {
        drawSprite(sprite, row, col, drawUnitPos);
    }
    context.globalAlpha = 1;
}

function drawUnit(i)
{
    const { team, color, unit, pos, vel, accel, angle, target, hp, aiState, atkState, physState, hitState, debugState } = gameState.entities;

    let alpha = 1;
    let colorOverlay = null;
    if (hitState[i].state == HITSTATE.DEAD) {
        const f = hitState[i].deadTimer / params.deathTimeMs;
        alpha = f;
        if (hitState[i].fallTimer > 0) {
            //unitScale = (1 - params.fallSizeReduction) + (hitState[i].fallTimer / params.fallTimeMs) * params.fallSizeReduction;
        }
    } else {
        strokeCircle(pos[i], unit[i].radius, 1, color[i]);
    }
    // flash red when hit
    if (hitState[i].hitTimer > 0) {
        const f = clamp(hitState[i].hitTimer / params.hitFadeTimeMs, 0, 1);
        colorOverlay = `rgba(255, 0, 0, ${f})`
    }
    drawUnitAnim(i, alpha, colorOverlay);
    drawWeapon(i);
    // don't draw debug stuff for base
    if (unit[i].id == UNIT.BASE) {
        return;
    }
    if (!debug.drawUI) {
        return;
    }
    // all this stuff is debug only, later we wanna draw sprites
    if (debug.drawCollision && physState[i].colliding) {
        strokeCircle(pos[i], unit[i].radius, 1, 'red');
    }
    if (debug.drawSightRange && unit[i].sightRange > 0)
    {
        strokeCircle(pos[i], unit[i].sightRange + unit[i].radius, 1, 'yellow');
    }
    // TODO remove
    if (debugState[i].velPreColl) {
        const arrowLine = vecMul(debugState[i].velPreColl, 10);
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, "#00ffff");
    }
    /*if (debugState[i].stopRange) {
        const arrowLine = debugState[i].stopRange;
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, debugState[i].stopping ? 'red' : '#00ff00');
    }*/
    if (debug.drawAngle) {
        const arrowLine = vecMulBy(vecFromAngle(angle[i]), 10);
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, 'white');
    }
    if (debug.drawVel) {
        const arrowLine = vecMul(vel[i], 10);
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, '#0066ff');
    }
    if (debug.drawAccel) {
        const arrowLine = vecMul(accel[i], 10);
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, '#ffdd00');
    }
    if (debug.drawAiState) {
        const color = aiState[i].state == AISTATE.PROCEED ? 'blue' : aiState[i].state == AISTATE.CHASE ? 'yellow' : 'red';
        const off = vecMulBy(vecFromAngle(angle[i]), -unit[i].radius*0.75);
        fillCircle(vecAdd(pos[i], off), unit[i].radius/3, color);
    }
}

function drawLine(posFrom, posTo, width, strokeStyle) {
    const posFromScreen = worldVecToCamera(posFrom);
    const posToScreen = worldVecToCamera(posTo);
    context.strokeStyle = strokeStyle;
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.beginPath();
    context.moveTo(posFromScreen.x, posFromScreen.y);
    context.lineTo(posToScreen.x, posToScreen.y);
    context.stroke();
}

function drawWeapon(i)
{
    const { team, color, unit, pos, vel, accel, angle, target, hp, aiState, atkState, physState, hitState, debugState } = gameState.entities;
    const weapon = getUnitWeapon(unit[i]);
    if (atkState[i] == ATKSTATE.NONE || weapon.id <= UNIT.BASE) {
        return;
    }

    switch(weapon.id) {
        case (UNIT.BIGEYE):
        {
            switch(atkState[i].state) {
                case ATKSTATE.AIM:
                    break;
                case ATKSTATE.SWING:
                {
                    const hitPos = atkState[i].aoeHitPos;
                    const f = clamp(1 - atkState[i].timer / weapon.recoverMs, 0, 1);
                    const colorLaser = `rgb(255,${255*f},255)`;
                    drawLine(pos[i], hitPos, 2, colorLaser);
                    break;
                }
                case ATKSTATE.RECOVER:
                {
                    const hitPos = atkState[i].aoeHitPos;
                    const f = clamp(atkState[i].timer / weapon.recoverMs, 0, 1);
                    const colorLaser = `rgb(255,${255*f},255)`;
                    const colorBoom = `rgba(${55+200*f},${200*f},0,${clamp(f*2,0,1)}`;
                    // boom
                    fillCircle(hitPos, weapon.aoeRadius, colorBoom);
                    // laser
                    drawLine(pos[i], hitPos, weapon.aoeRadius/2, colorLaser);
                    fillCircle(pos[i], weapon.aoeRadius/4, colorLaser);
                    fillCircle(hitPos, weapon.aoeRadius/3, colorLaser);
                    break;
                }
            }
            break;
        }
        default:
        {
            if (!debug.drawUI || !debug.drawSwing) {
                break;
            }
            const t = target[i].getIndex();
            if (t == INVALID_ENTITY_INDEX) {
                break;
            }
            const dir = vecNormalize(vecSub(pos[t], pos[i]));
            const tangent = vecTangentRight(dir);
            const offTangent = vecMul(tangent, unit[i].radius*0.5);
            const off = vecMul(dir, unit[i].radius*0.75);
            const didHit = atkState[i].didHit;
            let color = 'rgb(200,200,200)';
            vecAddTo(off, offTangent);
            const finalPos = vecAdd(pos[i], off);
            switch(atkState[i].state) {
                case ATKSTATE.AIM:
                    break;
                case ATKSTATE.SWING:
                {
                    const f = clamp(1 - atkState[i].timer / weapon.swingMs, 0, 1);
                    const forwardOff = vecMul(dir, f*weapon.range);
                    vecAddTo(finalPos, forwardOff);
                    const num = 100+155*f;
                    color = didHit ? `rgb(${num}, 20, 20)` : `rgb(${num},${num},${num},)`;
                    break;
                }
                case ATKSTATE.RECOVER:
                {
                    const f = clamp(atkState[i].timer / weapon.recoverMs, 0, 1);
                    const forwardOff = vecMul(dir, f*weapon.range);
                    vecAddTo(finalPos, forwardOff);
                    color = didHit ? 'rgb(100,20,20)' : 'rgb(200,200,200)';
                    break;
                }
            }
            fillEquilateralTriangle(finalPos, vecToAngle(dir), 5, 8, color);
            break;
        }
    }
    if (debug.drawUI && debug.drawWeaponRange && weapon.range > 0)
    {
        strokeCircle(pos[i], weapon.range + unit[i].radius, 1, 'red');
    }
}

function drawHpBar(i)
{
    const { team, unit, pos, vel, angle, target, hp, atkState, physState, hitState } = gameState.entities;
    // hp bar
    if (hitState[i].hpBarTimer > 0) {
        const hpBarWidth = unit[i].radius*2;
        const hpBarHeight = 3;
        const hpOff = vec(-hpBarWidth*0.5, -(unit[i].radius + unit[i].radius*0.75)); // idk
        const hpPos = vecAdd(pos[i], hpOff);
        const hpPercent = hp[i]/unit[i].maxHp;
        const filledWidth = hpPercent * hpBarWidth;
        const emptyWidth = (1 - hpPercent) * hpBarWidth;
        const emptyPos = vecAdd(hpPos, vec(filledWidth, 0))
        const hpAlpha = clamp(hitState[i].hpBarTimer / (params.hpBarTimeMs*0.5), 0, 1); // fade after half the time expired
        fillRectangle(hpPos, filledWidth, hpBarHeight, `rgba(0,255,0,${hpAlpha})`);
        fillRectangle(emptyPos, emptyWidth, hpBarHeight, `rgba(255,0,0,${hpAlpha})`);
    }
}

function strokeCircle(worldPos, radius, width, strokeStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    context.beginPath();
    context.arc(coords.x, coords.y, radius / gameState.camera.scale, 0, 2 * Math.PI);
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.strokeStyle = strokeStyle;
    context.stroke();
}

function fillCircle(worldPos, radius, fillStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    context.beginPath();
    context.arc(coords.x, coords.y, radius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fillStyle = fillStyle;
    context.fill();
}

function strokeCapsule(worldPos, length, radius, angle, width, strokeStyle, half=false)
{
    const dir = vecFromAngle(angle);
    const line = vecMul(dir, length);
    const worldEnd = vecAdd(worldPos, line);
    const endCoords = worldToCamera(worldEnd.x, worldEnd.y); // where the circle center will be
    const originCoords = worldToCamera(worldPos.x, worldPos.y); // start of the line
    vecRotateBy(dir, Math.PI/2); // get the direction where we'll offset to get the side lines of the capsule
    const offset = vecMul(dir, radius);
    const left = vecAdd(worldPos, offset);
    vecNegate(offset);
    const right = vecAdd(worldPos, offset);
    const leftOrigCoords = worldVecToCamera(left);
    const rightOrigCoords = worldVecToCamera(right);
    vecAddTo(left, line);
    vecAddTo(right, line);
    const leftEndCoords = worldVecToCamera(left);
    const rightEndCoords = worldVecToCamera(right);

    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.strokeStyle = strokeStyle;

    context.beginPath();
    context.moveTo(leftOrigCoords.x, leftOrigCoords.y);
    context.lineTo(leftEndCoords.x, leftEndCoords.y);
    context.moveTo(rightOrigCoords.x, rightOrigCoords.y);
    context.lineTo(rightEndCoords.x, rightEndCoords.y);
    context.arc(endCoords.x, endCoords.y, radius / gameState.camera.scale, angle - Math.PI/2, angle + Math.PI/2);
    context.stroke();
    if (!half) {
        context.beginPath();
        context.arc(originCoords.x, originCoords.y, radius / gameState.camera.scale, angle + Math.PI/2, angle - Math.PI/2);
        context.stroke();
    }
}

function strokeHalfCapsule(worldPos, length, radius, angle, width, strokeStyle)
{
    strokeCapsule(worldPos, length - radius, radius, angle, width, strokeStyle, true);
}

function fillEquilateralTriangle(worldPos, angle, base, height, fillStyle, fromCenter=true)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledBase = base / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    // points right - so angle == 0
    const triPoints = fromCenter ?
        [
            vec(-scaledHeight/2, -scaledBase/2),
            vec(scaledHeight/2, 0),
            vec(-scaledHeight/2, scaledBase/2),
        ] :
        [
            vec(0, -scaledBase/2),
            vec(scaledHeight, 0),
            vec(0, scaledBase/2),
        ];

    // rotate to angle
    triPoints.forEach((v) => vecRotateBy(v, angle));

    // move to coords
    triPoints.forEach((v) => vecAddTo(v, coords));

    context.beginPath();
    context.moveTo(triPoints[2].x, triPoints[2].y);
    for (let i = 0; i < triPoints.length; ++i) {
        context.lineTo(triPoints[i].x, triPoints[i].y);
    }

    context.fillStyle = fillStyle;
    context.fill();

}

function fillRectangleScreen(pos, width, height, fillStyle, fromCenter=false)
{
    let coords = pos;
    if (fromCenter) {
        coords = vec(pos.x - width * 0.5, pos.y - height * 0.5);
    }
    context.beginPath();
    context.rect(coords.x, coords.y, width, height);
    context.fillStyle = fillStyle;
    context.fill();
}

function fillRectangle(worldPos, width, height, fillStyle, fromCenter=false) {
    let coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledWidth = width / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    fillRectangleScreen(coords, scaledWidth, scaledHeight, fillStyle, fromCenter);
}

function drawIsland(team, island)
{
    const teamColor = params.playerColors[team];
    const coords = worldToCamera(island.pos.x, island.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, (params.islandRadius - 50) / gameState.camera.scale, coords.x, coords.y, params.islandRadius / gameState.camera.scale);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, params.baseFadeColor);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, params.islandRadius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fill();


    context.strokeStyle = params.pathColor;
    context.setLineDash([]);
    context.lineWidth = params.pathWidth / gameState.camera.scale;

    for (const path of island.paths) {
        const points = path.map(v => worldVecToCamera(v));
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        context.lineTo(points[1].x, points[1].y);
        context.stroke();
    }
}

function drawArrow(start, end, width, strokeStyle)
{
    const startCoords = worldVecToCamera(start);
    const endCoords = worldVecToCamera(end);
    // arrow as a vector in screen space
    const arrowDir = vecSub(endCoords, startCoords);
    const arrowLen = vecLen(arrowDir);
    const barbX = arrowLen - (5 / gameState.camera.scale);
    const barby = 5 / gameState.camera.scale; // always make head visible
    // arrow points to rotate
    const arrowPoints = [
        vec(),              // start
        vec(arrowLen, 0),   // end
        vec(barbX, barby),  // right
        vec(barbX, -barby), // left
    ];
    const arrowAngle = vecToAngle(arrowDir);
    arrowPoints.forEach(v => vecRotateBy(v, arrowAngle));
    arrowPoints.forEach(v => vecAddTo(v, startCoords));

    context.strokeStyle = strokeStyle;
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;

    context.beginPath();
    // shaft
    context.moveTo(arrowPoints[0].x, arrowPoints[0].y);
    context.lineTo(arrowPoints[1].x, arrowPoints[1].y);
    // barbs
    context.moveTo(arrowPoints[2].x, arrowPoints[2].y);
    context.lineTo(arrowPoints[1].x, arrowPoints[1].y);
    context.lineTo(arrowPoints[3].x, arrowPoints[3].y);
    context.stroke();
}

function strokePoints(arr, width, strokeStyle)
{
    // line segments
    context.strokeStyle = strokeStyle;
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.beginPath();
    const points = arr.map(v => worldVecToCamera(v));
    context.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; ++i) {
        context.lineTo(points[i].x, points[i].y);
    }
    context.stroke();
}

function capsulePoints(arr, radius, strokeWidth, strokeStyle)
{
    for (let i = 0; i < arr.length - 1; ++i) {
        const v = vecSub(arr[i+1], arr[i]);
        const angle = vecToAngle(v);
        strokeCapsule(arr[i], vecLen(v), radius, angle, strokeWidth, strokeStyle);
    }
}

function dotPoints(arr, radius, fillStyle)
{
    for (let i = 0; i < arr.length; ++i) {
        fillCircle(arr[i], radius, fillStyle);
    }
}

function drawLane(laneIdx, hovered)
{
    const lane = gameState.lanes[laneIdx];
    // lanes; bezier curves
    context.setLineDash([]);
    context.lineWidth = params.laneWidth / gameState.camera.scale;
    context.strokeStyle = hovered ? params.laneHoveredColor : params.laneColor;
    context.beginPath();
    const bezPoints = lane.bezierPoints.map(v => worldVecToCamera(v));
    context.moveTo(bezPoints[0].x, bezPoints[0].y);
    context.bezierCurveTo(bezPoints[1].x, bezPoints[1].y, bezPoints[2].x, bezPoints[2].y, bezPoints[3].x, bezPoints[3].y);
    context.stroke();

    if (debug.drawBezierPoints) {
        strokePoints(lane.bezierPoints, 3, "#00ff00");
    }

    if (debug.drawLaneSegs) {
        const bridgePoints = lane.playerLanes[0].bridgePoints[0];
        strokePoints(bridgePoints, 5, "#ff0000");
        capsulePoints(bridgePoints, params.laneWidth*0.5, 4, "#ffff00");
        dotPoints(bridgePoints, 7, "#0000ff");
        fillCircle(lane.playerLanes[0].spawnPos, 8, "#00ff00");
        fillCircle(lane.playerLanes[1].spawnPos, 8, "#00ff00");
    }

    const dreamer = lane.dreamer;
    fillCircle(vecAdd(lane.middlePos, vec(0, -params.laneWidth)), 15, dreamer.color);
}

export function getBoundingClientRect()
{
    return canvas.getBoundingClientRect();
}

function drawPlayerUI(player)
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
        fillRectangleScreen(pos, buttonDims.x, buttonDims.y, "#444444");
        // draw sprite
        if (unit.draw.sprite) {
            const sprite = unit.draw.sprite;
            const spriteDrawPos = vecAdd(pos, vecMul(buttonDims, 0.5))
            vecSubFrom(spriteDrawPos, vecMulBy(vec(sprite.width, sprite.height), 0.5));
            drawSpriteScreen(sprite, 0, 0, spriteDrawPos);
        }
        // hotKey
        if (player.controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
            drawTextScreen(`[${key}]`, vec(pos.x + buttonDims.x - 5, pos.y + 20), 20, 'white', true, 'right');
        }
        // overlay if can't afford
        let costColor = '#ffdd22';
        if (player.gold < unit.goldCost) {
            fillRectangleScreen(pos, buttonDims.x, buttonDims.y, "rgba(20,20,20,0.6)");
            costColor = '#ff7744';
        }
        if (player.unitCds[unit.id] > 0) {
            const f = (player.unitCds[unit.id] / unit.cdTimeMs);
            fillRectangleScreen(pos, buttonDims.x, buttonDims.y * f, "rgba(20,20,20,0.6)");
        }
        drawTextScreen(`$${unit.goldCost}`, vec(pos.x,pos.y + buttonDims.y), 20, costColor, true);
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
            fillEquilateralTriangle(pos, vecToAngle(dir), 15, 20, player.color);
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
    fillRectangleScreen(vec(barStartX, barY), greenWidth, 16, '#00ff00');
    fillRectangleScreen(vec(redStartX, barY), redWidth, 16, '#ff0000');
}

function drawUI()
{
    for (let i = 0; i < gameState.players.length; ++i) {
        const player = gameState.players[i];
        drawPlayerUI(player);
    }
}

export function draw(realTimeMs, timeDeltaMs)
{
    const localPlayer = getLocalPlayer();
    updateCameraSize(canvas.width, canvas.height);

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = params.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const [team, base] of Object.entries(gameState.islands)) {
        drawIsland(team, base);
    }

    for (let i = 0; i < gameState.lanes.length; ++i) {
        drawLane(i, localPlayer.laneHovered == i);
    }

    const { exists, team, unit, pos, angle, physState, hitState } = gameState.entities;
    // TODO bit of hack to draw alive units on top of dead ones
    // draw dead
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i] || (hitState[i].state != HITSTATE.DEAD)) {
            continue;
        }
        drawUnit(i);
    }
    //draw alive
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i] || (hitState[i].state != HITSTATE.ALIVE)) {
            continue;
        }
        drawUnit(i);
    }
    // only draw UI while game is running
    if (App.state.screen == SCREEN.GAME) {
        // health bars on top!
        for (let i = 0; i < exists.length; ++i) {
            if (!exists[i]) {
                continue;
            }
            drawHpBar(i);
        }

        if (debug.drawUI) {
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
            drawDebugTextScreen(`debug mode [${debug.paused ? 'paused' : 'running'}]`, vec(10,20), 'white');
            let yoff = 45;
            for (const { key, text } of debugHotKeys) {
                drawDebugTextScreen(` '${key}'  ${text}`, vec(10,yoff), 'white');
                yoff += 25;
            }
            if (debug.drawFPS) {
                const fpsStr = `FPS: ${Number(debug.fps).toFixed(2)}`;
                drawTextScreen(fpsStr, vec(canvas.width - 10,20), 20, 'white', true, 'right');
            }
            if (debug.drawNumUpdates) {
                const updatesStr= `updates/frame: ${Number(debug.avgUpdates).toFixed(2)}`;
                drawTextScreen(updatesStr, vec(canvas.width - 10,40), 20, 'white', true, 'right');
            }
        }
        drawUI();
    }
}

function drawTextScreen(string, pos, sizePx, fillStyle, stroke=false, align='left')
{
    context.font = `${sizePx}px sans-serif`;
    context.textAlign = align;
    if (stroke) {
        context.strokeStyle = 'black';
        context.setLineDash([]);
        context.lineWidth = 3;
        context.strokeText(string, pos.x, pos.y);
    }
    context.fillStyle = fillStyle;
    context.fillText(string, pos.x, pos.y);
}

function drawText(string, worldPos, sizePx, fillStyle, stroke=false, align='center')
{
    const scaledSize = sizePx / gameState.camera.scale;
    const coords = worldVecToCamera(worldPos);
    drawTextScreen(string, coords, scaledSize, fillStyle, stroke, align);
}

function drawDebugTextScreen(string, pos)
{
    drawTextScreen(string, pos, 20, 'white', true, 'left');
}

function drawDebugText(string, worldPos)
{
    drawText(string, worldPos, 20, 'white', true, 'center');
}

export function init()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");
}
