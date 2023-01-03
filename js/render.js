import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import * as UI from './UI.js';
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);
Object.entries(Draw).forEach(([name, exported]) => window[name] = exported);

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
        context.fillStyle = "#000";
        context.fillRect(drawPos.x, drawPos.y, drawWidth, drawHeight);
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
        context.fillStyle = "#000";
        context.fillRect(drawPos.x, drawPos.y, drawWidth, drawHeight);
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
        strokeCircleWorld(context, pos[i], unit[i].radius, 1, color[i]);
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
        strokeCircleWorld(context, pos[i], unit[i].radius, 1, 'red');
    }
    if (debug.drawSightRange && unit[i].sightRange > 0) {
        strokeCircleWorld(context, pos[i], unit[i].sightRange + unit[i].radius, 1, 'yellow');
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
        fillCircleWorld, (context, vecAdd(pos[i], off), unit[i].radius/3, color);
    }
}

function drawHpBar(i)
{
    const { unit, pos, vel, angle, target, hp, atkState, physState, hitState } = gameState.entities;
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
        fillRectWorld(context, hpPos, vec(filledWidth, hpBarHeight), `rgba(0,255,0,${hpAlpha})`);
        fillRectWorld(context, emptyPos, vec(emptyWidth, hpBarHeight), `rgba(255,0,0,${hpAlpha})`);
    }
}

function drawTraceParticles(origin, particles)
{
    const numParticles = particles.length;
    for (let i = 0; i < numParticles; ++i) {
        const particle = particles[i];
        strokeLineWorld(context, origin, particle.pos, particle.width, particle.color);
    }
}

function drawVFX(i)
{
    const { pos, vfxState } = gameState.entities;
    const vfx = vfxState[i];

    switch(vfxState[i].type) {
        case (VFX.BIGEYE_BEAM):
        {
            const weapon = weapons[UNIT.BIGEYE];
            const f = clamp(1 - vfx.timeMs / vfx.totalTimeMs, 0, 1);
            const colorLaser = `rgb(255,${255*f},255)`;
            strokeLineWorld(context, pos[i], vfx.hitPos, f*weapon.aoeRadius/2, colorLaser);
            fillCircleWorld(context, pos[i], f*weapon.aoeRadius/4, colorLaser);
            fillCircleWorld(context, vfx.hitPos, weapon.aoeRadius/3, colorLaser);
            break;
        }
        case (VFX.EXPLOSION):
        {
            const f = clamp(vfx.timeMs / vfx.totalTimeMs, 0, 1);
            const colorBoom = `rgba(${55+200*f},${200*f},0,${clamp(f*2,0,1)}`;
            fillCircleWorld(context, pos[i], vfx.radius, colorBoom);
            break;
        }
        case (VFX.TANK_SPARKS):
        {
            drawTraceParticles(pos[i], vfx.traceParticles);
            break;
        }
        default:
    }
}

function drawWeapon(i)
{
    const { team, color, unit, pos, vel, accel, angle, target, hp, aiState, atkState, physState, hitState, debugState } = gameState.entities;
    const weapon = getUnitWeapon(unit[i]);
    if (atkState[i] == ATKSTATE.NONE || weapon.id <= UNIT.BASE) {
        return;
    }

    switch(weapon.id) {
        case (UNIT.CHOGORINGU):
        case (UNIT.TANK):
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
            fillTriangleWorld(context, finalPos, vecToAngle(dir), 5, 8, color);
            break;
        }
    }
    if (debug.drawUI && debug.drawWeaponRange && weapon.range > 0)
    {
        strokeCircleWorld(context, pos[i], weapon.range + unit[i].radius, 1, 'red');
    }
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
        fillCircleWorld(context, arr[i], radius, fillStyle);
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
        fillCircleWorld(context, lane.playerLanes[0].spawnPos, 8, "#00ff00");
        fillCircleWorld(context, lane.playerLanes[1].spawnPos, 8, "#00ff00");
    }

    const dreamer = lane.dreamer;
    fillCircleWorld(context, vecAdd(lane.middlePos, vec(0, -params.laneWidth)), 15, dreamer.color);
}

export function getBoundingClientRect()
{
    return canvas.getBoundingClientRect();
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
        if (!entityExists(i, ENTITY.UNIT) || (hitState[i].state != HITSTATE.DEAD)) {
            continue;
        }
        drawUnit(i);
    }
    //draw alive
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT) || (hitState[i].state != HITSTATE.ALIVE)) {
            continue;
        }
        drawUnit(i);
    }
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.VFX)) {
            continue;
        }
        drawVFX(i);
    }
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        drawHpBar(i);
    }
    const UIcanvas = UI.getCanvas();
    context.drawImage(UIcanvas, 0, 0);
    if (UIcanvas.width != canvas.width || UIcanvas.height != canvas.height) {
        UI.updateDims(canvas.width, canvas.height);
    }
}

export function init()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");
}
