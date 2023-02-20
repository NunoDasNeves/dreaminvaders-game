import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as Draw from './draw.js';
import * as UI from './UI.js';
import { canBuildUnit } from './game.js';
import { assets } from './assets.js';
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

function drawUnitAnim(i, alpha, colorOverlay)
{
    const { team, playerId, unit, pos, angle, color, animState } = gameState.entities;
    const { anim, frame, timer, loop } = animState[i];
    let flip = false;
    if (vecFromAngle(angle[i]).x < 0) {
        flip = true;
    }
    const sprite = animState[i].sprite;
    const animObj = sprite.anims[anim];
    const col = animObj.col + frame;
    const flipOffset = flip ? sprite.rows : 0;
    let colorOffset = 0;
    if (sprite.playerColors) {
        colorOffset = sprite.rows * 2 * gameState.players[playerId[i]].colorIdx;
    }
    const row = animObj.row + flipOffset + colorOffset;
    const drawUnitPos = getDrawUnitPos(pos[i], sprite.width, sprite.height, sprite.centerOffset);

    if (unit[i].id == UNIT.DREAMER) {
        const circlePos = vecSub(pos[i], sprite.centerOffset);
        fillCircleWorld(context, circlePos, 24, color[i]);
    }
    context.globalAlpha = alpha;
    drawSprite(context, sprite, row, col, drawUnitPos, colorOverlay);
    context.globalAlpha = 1;
}

function drawUnitShadow(i)
{
    const { unit, pos } = gameState.entities;
    if (unit[i].shadowWidth == 0) {
        return;
    }
    const shadowPos = vecClone(pos[i]);
    shadowPos.y += unit[i].shadowOffsetY;
    const radii = vec(unit[i].shadowWidth, unit[i].shadowWidth * 0.3);
    fillEllipseWorld(context, shadowPos, radii, "#0004");
}

function drawUnit(i)
{
    const { team, color, unit, pos, vel, accel, angle, target, hp, aiState, atkState, physState, hitState, debugState } = gameState.entities;

    let alpha = 1;
    let colorOverlay = null;
    switch (hitState[i].state) {
        case HITSTATE.SPAWN:
        {
            const f = 1 - hitState[i].spawnTimer / unit[i].spawnTimeMs;
            alpha = f;
            break;
        }
        case HITSTATE.ALIVE:
        {
            if (debug.drawCollision) {
                strokeCircleWorld(context, pos[i], unit[i].radius, 1, color[i]);
            }
            break;
        }
        case HITSTATE.DEAD:
        {
            const f = hitState[i].deadTimer / params.deathTimeMs;
            alpha = f;
            break;
        }
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
        if (debugState[i].velPreColl) {
            const arrowLine = vecMul(debugState[i].velPreColl, 10);
            drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, "#00ffff");
        }
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
    const { unit, pos, hp, animState, hitState } = gameState.entities;

    const sprite = animState[i].sprite;
    // hp bar
    if (hitState[i].hpBarTimer > 0) {
        const hpBarWidth = sprite.width;
        const hpBarHeight = Math.min(Math.max(sprite.height * 0.1, 3), 8);
        const hpPos = getDrawUnitPos(pos[i], sprite.width, sprite.height, sprite.centerOffset);
        hpPos.y -= hpBarHeight*1.5;
        const hpPercent = hp[i]/unit[i].hp;
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

function drawSoul(i)
{
    const { playerId, pos, vel, accel, soulState } = gameState.entities;
    const soul = soulState[i];
    const player = gameState.players[playerId[i]];

    // tail
    const p = vecClone(pos[i]);
    const dir = vecNormalize(vecClone(vel[i]));
    vecAddTo(p, vecMul(dir, -6));
    fillCircleWorld(context, p, 4, params.soulsTextColor);
    vecAddTo(p, vecMul(dir, -6));
    fillCircleWorld(context, p, 3, params.soulsTextColor);
    vecAddTo(p, vecMul(dir, -4));
    fillCircleWorld(context, p, 2, params.soulsTextColor);
    vecAddTo(p, vecMul(dir, -3));
    fillCircleWorld(context, p, 1, params.soulsTextColor);

    // sprite
    const asset = assets.images.soul;
    const imgDims = vec(asset.width, asset.height);
    const drawPos = vecSub(pos[i], vecMul(imgDims, 0.5));
    drawImageWorld(context, asset.img, drawPos, imgDims);
}

function drawVFX(i)
{
    const { pos, vfxState } = gameState.entities;
    const vfx = vfxState[i];

    switch(vfxState[i].type) {
        case (VFX.BIGEYE_BEAM):
        {
            const weapon = getUnitWeapon(units[UNIT.BIGEYE]);
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
        case (VFX.STATICD_BEAM):
        {
            const f = clamp(vfx.timeMs / vfx.totalTimeMs, 0, 1);
            const colorLaser = `rgb(255,${255*f},255)`;
            strokeLineWorld(context, pos[i], vfx.endPos, f*10, vfx.color);
            break;
        }
        case (VFX.TEXT):
        {
            const f = clamp(vfx.timeMs / vfx.totalTimeMs, 0, 1);
            const textPos = vecAdd(pos[i], vec(0, (1-f)*-20));
            drawText(vfx.string, textPos, vfx.textSize, vfx.color, true);
            break;
        }
        case (VFX.SCREAM):
        {
            const f = clamp(vfx.timeMs / vfx.totalTimeMs, 0, 1);
            const screamPos = vecAdd(pos[i], vec(0, (1-f)*-20));
            const asset = assets.images.scream;
            const imgDims = vec(asset.width, asset.height);
            const drawPos = vecSub(screamPos, vecMul(imgDims, 0.5));
            drawImageWorld(context, asset.img, drawPos, imgDims);
            break;
        }
        default:
    }
}

function drawText(string, worldPos, sizePx, fillStyle, stroke=false, align='center')
{
    if (stroke) {
        strokeTextWorld(context, string, worldPos, sizePx, 3, 'black', align);
    }
    fillTextWorld(context, string, worldPos, sizePx, fillStyle, align);
}

// TODO this is really drawDebugWeapon - currently does nothing without debug draw enabled
function drawWeapon(i)
{
    const { team, color, unit, pos, vel, accel, angle, target, hp, aiState, atkState, physState, hitState, debugState } = gameState.entities;
    const weapon = getUnitWeapon(unit[i]);
    if (aiState[i].state != AISTATE.ATK) {
        return;
    }

    switch(unit.id) {
        case UNIT.BASE:
            break;
        case UNIT.CHOGORINGU:
        case UNIT.TANK:
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
    const spr = island.sprite;
    const sprPos = vecAdd(island.pos, spr.centerOffset);
    drawSprite(context, spr, island.flipSprite ? 1 : 0, 0, sprPos);

    /*const teamColor = params.playerColors[team];
    const coords = worldToCamera(island.pos.x, island.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, (params.islandRadius - 50) / gameState.camera.scale, coords.x, coords.y, params.islandRadius / gameState.camera.scale);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, params.baseFadeColor);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, params.islandRadius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fill();

    for (const path of island.paths) {
        strokePoints(path, params.pathWidth, params.pathColor);
    }
    */
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

function drawUnderBridge(laneIdx)
{
    const underColor = "rgb(50,50,50)";
    const bridge = gameState.bridges[laneIdx];
    const bridgePointsR2L = bridge.bridgePoints.map(vecClone).reverse();
    const bridgeUnderPoints = bridgePointsR2L.map(vecClone);
    const bridgeThickness = 55 + laneIdx*14;
    const bridgeArchHeight = 300;
    bridgeUnderPoints.unshift(vecAdd(bridgeUnderPoints[0], vec(0, bridgeThickness + bridgeArchHeight)));
    bridgeUnderPoints.push(vecAdd(bridgeUnderPoints[bridgeUnderPoints.length - 1], vec(0, bridgeThickness + bridgeArchHeight)));
    const archPointsOnBez = [
        vecClone(bridgePointsR2L[bridgePointsR2L.length - 2]),
        cubicBezierPoint(bridge.bezierPoints, 0.48),
        cubicBezierPoint(bridge.bezierPoints, 0.52),
        vecClone(bridgePointsR2L[1]),
    ].map(v => vecAddTo(v, vec(0, bridgeThickness)));
    // get the midpoints by average
    const archMidPoints = [
        vecMulBy(vecAdd(archPointsOnBez[0], archPointsOnBez[1]), 0.5),
        vecMulBy(vecAdd(archPointsOnBez[2], archPointsOnBez[3]), 0.5),
    ];

    const archBez = [
        [
            vecAdd(archPointsOnBez[0], vec(0, bridgeArchHeight)),
            archPointsOnBez[0],
            archPointsOnBez[0],
            archMidPoints[0],
        ],[
            archMidPoints[0],
            archPointsOnBez[1],
            archPointsOnBez[1],
            vecAdd(archPointsOnBez[1], vec(0, bridgeArchHeight)),
        ],[
            vecAdd(archPointsOnBez[2], vec(0, bridgeArchHeight)),
            archPointsOnBez[2],
            archPointsOnBez[2],
            archMidPoints[1],
        ],[
            archMidPoints[1],
            archPointsOnBez[3],
            archPointsOnBez[3],
            vecAdd(archPointsOnBez[3], vec(0, bridgeArchHeight)),
        ],
    ];

    context.beginPath();
    const startPoint = worldVecToCamera(vec(bridgeUnderPoints[0].x, bridgeUnderPoints[0].y));
    context.moveTo(startPoint.x, startPoint.y);
    for (const point of bridgeUnderPoints) {
        const coord = worldVecToCamera(point);
        context.lineTo(coord.x, coord.y);
    }
    for (const archBezArr of archBez) {
        const bezArr = archBezArr.map(worldVecToCamera);
        context.lineTo(bezArr[0].x, bezArr[0].y);
        context.bezierCurveTo(bezArr[1].x, bezArr[1].y, bezArr[2].x, bezArr[2].y, bezArr[3].x, bezArr[3].y);
    }
    const gradStartY = worldVecToCamera(archPointsOnBez[0]).y;
    const gradEndY = worldVecToCamera(vecAdd(archBez[1][3], vec(0, -150))).y;
    const grad = context.createLinearGradient(0, gradStartY, 0, gradEndY);
    grad.addColorStop(1, "#0000");
    grad.addColorStop(0, underColor);
    context.fillStyle = grad;
    context.fill();

    //dotPoints(bridgePointsR2L, 3, 'purple');
    //dotPoints(archPointsOnBez, 3, 'yellow');
    //dotPoints(archMidPoints, 3, 'cyan');
}

function drawBridge(laneIdx, hovered)
{
    const bridge = gameState.bridges[laneIdx];
    const bezPoints = bridge.bezierPoints.map(worldVecToCamera);

    context.setLineDash([]);
    context.lineWidth = params.laneWidth / gameState.camera.scale;
    context.strokeStyle = params.laneColor;
    context.beginPath();
    context.moveTo(bezPoints[0].x, bezPoints[0].y);
    context.bezierCurveTo(bezPoints[1].x, bezPoints[1].y, bezPoints[2].x, bezPoints[2].y, bezPoints[3].x, bezPoints[3].y);
    context.stroke();

    // spawn platforms
    fillCircleWorld(context, bridge.playerLanes[0].spawnPos, params.spawnPlatRadius, hovered ? params.laneHoveredColor : params.laneColor);
    fillCircleWorld(context, bridge.playerLanes[1].spawnPos, params.spawnPlatRadius, params.laneColor);

    if (debug.drawBezierPoints) {
        strokePoints(bridge.bezierPoints, 3, "#00ff00");
    }

    if (debug.drawLaneSegs) {
        const bridgePoints = bridge.bridgePoints[0];
        strokePoints(bridgePoints, 5, "#ff0000");
        capsulePoints(bridgePoints, params.laneWidth*0.5, 4, "#ffff00");
        dotPoints(bridgePoints, 7, "#0000ff");
        fillCircleWorld(context, bridge.playerLanes[0].spawnPos, 8, "#00ff00");
        fillCircleWorld(context, bridge.playerLanes[1].spawnPos, 8, "#00ff00");
    }
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

    const bgGradient = context.createLinearGradient(0, canvas.height, 0, 0);
    bgGradient.addColorStop(0, params.backgroundGradientBottom);
    bgGradient.addColorStop(1, params.backgroundGradientTop);
    context.fillStyle = bgGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < gameState.bridges.length; ++i) {
        drawUnderBridge(i);
    }

    for (const [team, base] of Object.entries(gameState.islands)) {
        drawIsland(team, base);
    }

    for (let i = 0; i < gameState.bridges.length; ++i) {
        drawBridge(i, localPlayer.laneSpawnHovered == i);
    }

    const { exists, team, unit, pos, angle, physState, hitState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        drawUnitShadow(i);
    }
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
        if (!entityExists(i, ENTITY.UNIT) || (hitState[i].state == HITSTATE.DEAD)) {
            continue;
        }
        drawUnit(i);
    }
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.SOUL)) {
            continue;
        }
        drawSoul(i);
    }
    if (localPlayer.mouseEnabled) {
        if (localPlayer.unitSelected >= 0) {
            const unit = units[localPlayer.unitSelected];
            const sprite = unitSprites[unit.defaultSpriteId];
            const spawnPos = gameState.input.mousePos;
            const drawUnitPos = getDrawUnitPos(spawnPos, sprite.width, sprite.height, sprite.centerOffset);
            const overlayColor = localPlayer.laneSpawnHovered >= 0 && canBuildUnit(localPlayer.id, unit, spawnPos) ? "#20f8" : "#8088";
            context.globalAlpha = 0.7;
            strokeCircleWorld(context, spawnPos, unit.radius, 1, overlayColor);
            drawSprite(context, sprite, 0, 0, drawUnitPos, overlayColor);
            context.globalAlpha = 1;
        }
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
