import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { debug, params, AISTATE, TEAM, ATKSTATE, weapons, units, HITSTATE, sprites } from "./data.js";
import { enemyTeam, laneStart, laneEnd, gameState, INVALID_ENTITY_INDEX, EntityRef, updateCameraSize, cameraToWorld, cameraVecToWorld, worldToCamera, worldVecToCamera } from './state.js'
import { assets } from "./assets.js";
export let canvas = null;
let context = null;

function drawCircleUnit(pos, unit, scale, strokeColor, fillColor)
{
    if (strokeColor) {
        strokeCircle(pos, unit.radius * scale, 2, strokeColor);
    }
    if (fillColor) {
        fillCircle(pos, unit.radius * scale, fillColor);
    }
}

function drawTriangleUnit(pos, angle, unit, scale, fillColor)
{
    fillEquilateralTriangle(pos, angle, unit.radius * scale, unit.radius * 1.5 * scale, fillColor);
}

function drawSprite(sprite, animName, frame, pos, flip)
{
    const anim = sprite.anims[animName];
    const asset = sprite.imgAsset;

    const drawWidth = sprite.width / gameState.camera.scale;
    const drawHeight = sprite.height / gameState.camera.scale;
    const drawPos = worldToCamera(pos.x, pos.y);
    const offset = vecNegate(vecAdd(vec(sprite.width/2, sprite.height/2), sprite.centerOffset));

    if (asset.loaded) {
        vecMulBy(offset, 1/gameState.camera.scale);
        vecAddTo(drawPos, offset);
        const sourceX = (anim.col + frame) * sprite.width;
        const sourceY = (anim.row + (flip ? sprite.rows : 0)) * sprite.height;
        context.imageSmoothingEnabled = false;
        context.drawImage(asset.img, sourceX, sourceY, sprite.width, sprite.height, drawPos.x, drawPos.y, drawWidth, drawHeight);
    } else {
        // fillRectangle takes pos in world coords
        const rectPos = vecAdd(pos, offset);
        fillRectangle(rectPos, sprite.width, sprite.height, "#000000", false);
    }
}

function drawUnitAnim(i)
{
    const { team, unit, pos, angle, animState } = gameState.entities;
    const { anim, frame, timer, loop } = animState[i];
    let flip = false;
    if (vecFromAngle(angle[i]).x < 0) {
        flip = true;
    }
    drawSprite(unit[i].draw.sprite, anim, frame, pos[i], flip);
}

function drawUnit(i)
{
    const { team, unit, pos, vel, angle, target, hp, aiState, atkState, physState, boidState, hitState } = gameState.entities;

    let unitScale = 1;
    let unitStrokeColor = unit[i].draw.strokeColor;
    if (unitStrokeColor == "TEAM") {
        unitStrokeColor = params.teamColors[team[i]];
    }
    let unitFillColor = unit[i].draw.fillColor;
    if (unitFillColor == "TEAM") {
        unitFillColor = params.teamColors[team[i]];
    }
    if (hitState[i].state == HITSTATE.DEAD) {
        const f = hitState[i].deadTimer / params.deathTimeMs;
        unitFillColor = `rgba(100,100,100,${f})`;
        if (hitState[i].fallTimer > 0) {
            unitScale = (1 - params.fallSizeReduction) + (hitState[i].fallTimer / params.fallTimeMs) * params.fallSizeReduction;
        }
    }

    strokeCircle(pos[i], unit[i].radius, 1, params.teamColors[team[i]]);
    // draw basic shape
    switch (unit[i].draw.shape) {
        case "triangle":
            drawTriangleUnit(pos[i], angle[i], unit[i], unitScale, unitFillColor);
            break;
        default:
            break;
    }
    if (unit[i].draw.image) {
        drawImage(unit[i].draw.image, pos[i]);
    }
    if (unit[i].draw.sprite) {
        drawUnitAnim(i);
    }
    // bloood
    if (hitState[i].hitTimer > 0) {
        const f = clamp(hitState[i].hitTimer / params.hitFadeTimeMs, 0, 1);
        const fill = `rgba(255, 0, 0, ${f})`
        fillCircle(pos[i], unit[i].radius, fill);
    }
    // don't draw debug stuff for base
    if (unit[i] == units.base) {
        return;
    }
    // all this stuff is debug only, later we wanna draw sprites
    if (debug.drawCollision && physState[i].colliding) {
        strokeCircle(pos[i], unit[i].radius, 1, 'red');
    }
    if (debug.drawSight && unit[i].sightRadius > 0)
    {
        strokeCircle(pos[i], unit[i].sightRadius, 1, 'yellow');
    }
    if (debug.drawAngle) {
        const arrowLine = vecMulBy(utils.vecFromAngle(angle[i]), 10);
        drawArrow(pos[i], vecAdd(pos[i], arrowLine), 1, 'white');
    }
    if (debug.drawState) {
        const color = aiState[i].state == AISTATE.PROCEED ? 'blue' : aiState[i].state == AISTATE.CHASE ? 'yellow' : 'red';
        const off = vecMulBy(vecFromAngle(angle[i]), -unit[i].radius*0.75);
        fillCircle(vecAdd(pos[i], off), unit[i].radius/3, color);
    }
    if (unit[i] == units.boid)
    {
        if (debug.drawCapsule) // && unit[i].avoiding)
        {
            strokeHalfCapsule(pos[i], unit[i].sightRadius, unit[i].radius, vecToAngle(boidState[i].seekForce), 1, boidState[i].avoiding ? '#00ff00' : 'green');
        }
        if (debug.drawForces)
        {
            if (boidState[i].avoiding) {
                drawArrow(pos[i], vecAdd(pos[i], vecMul(boidState[i].avoidanceForce, 20)), 1, 'red');
            }
            drawArrow(pos[i], vecAdd(pos[i], vecMul(boidState[i].seekForce, 20)), 1, 'white');
        }
    }
    if (debug.drawSwing) {
        const t = target[i].getIndex();
        if (unit[i].weapon != weapons.none && atkState[i].state != ATKSTATE.NONE && t != INVALID_ENTITY_INDEX) {
            const dir = vecNormalize(vecSub(pos[t], pos[i]));
            const tangent = vecTangentRight(dir);
            const offTangent = vecMul(tangent, unit[i].radius*0.5);
            const off = vecMul(dir, unit[i].radius*0.75);
            let f = 0;
            let color = 'rgb(100,20,20)';
            vecAddTo(off, offTangent);
            const finalPos = vecAdd(pos[i], off);
            switch(atkState[i].state) {
                case ATKSTATE.AIM:
                    break;
                case ATKSTATE.SWING:
                {
                    const f = clamp(1 - atkState[i].timer / unit[i].weapon.swingMs, 0, 1);
                    const forwardOff = vecMul(dir, f*unit[i].weapon.range);
                    vecAddTo(finalPos, forwardOff);
                    color = `rgb(${100 + 155*f}, 20, 20)`;
                    break;
                }
                case ATKSTATE.RECOVER:
                {
                    const f = clamp(atkState[i].timer / unit[i].weapon.recoverMs, 0, 1);
                    const forwardOff = vecMul(dir, f*unit[i].weapon.range);
                    vecAddTo(finalPos, forwardOff);
                    break;
                }
            }
            fillEquilateralTriangle(finalPos, vecToAngle(dir), 5, 8, color);
        }
    }
}

function drawHpBar(i)
{
    const { team, unit, pos, vel, angle, target, hp, atkState, physState, boidState, hitState } = gameState.entities;
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

function fillEquilateralTriangle(worldPos, angle, base, height, fillStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledBase = base / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    // points right - so angle == 0
    const triPoints = [
        vec(-scaledHeight/2, -scaledBase/2),
        vec(scaledHeight/2, 0),
        vec(-scaledHeight/2, scaledBase/2),
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

function fillRectangle(worldPos, width, height, fillStyle, fromCenter=false) {
    let coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledWidth = width / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    if (fromCenter) {
        coords.x -= scaledWidth / 2;
        coords.y -= scaledHeight / 2;
    }
    context.beginPath();
    context.rect(coords.x, coords.y, scaledWidth, scaledHeight);
    context.fillStyle = fillStyle;
    context.fill();
}

function drawImage(name, pos, fromCenter = true)
{
    const asset = assets.images[name];
    const drawWidth = asset.width / gameState.camera.scale;
    const drawHeight = asset.height / gameState.camera.scale;
    const drawPos = worldToCamera(pos.x, pos.y);
    const offset = vec();
    if (fromCenter) {
        vecSubFrom(offset, vecAdd(vec(asset.width/2, asset.height/2), asset.centerOffset));
    }

    if (asset.loaded) {
        vecMulBy(offset, 1/gameState.camera.scale);
        vecAddTo(drawPos, offset);
        context.imageSmoothingEnabled = false;
        context.drawImage(asset.img, drawPos.x, drawPos.y, drawWidth, drawHeight);
    } else {
        vecSubFrom(drawPos, offset);
        fillRectangle(pos, asset.width, asset.height, "#000000", false);
    }
}

function drawIsland(team, island)
{
    const teamColor = params.teamColors[team];
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
    const arrowDir = utils.vecSub(endCoords, startCoords);
    const arrowLen = vecLen(arrowDir);
    const barbX = arrowLen*7/8;
    const barby = arrowLen/8;
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

function drawLane(lane, selected)
{
    // lanes; bezier curves
    context.setLineDash([]);
    context.lineWidth = params.laneWidth / gameState.camera.scale;
    context.strokeStyle = selected ? params.laneSelectedColor : params.laneColor;
    context.beginPath();
    const bezPoints = lane.bezierPoints.map(v => worldVecToCamera(v));
    context.moveTo(bezPoints[0].x, bezPoints[0].y);
    context.bezierCurveTo(bezPoints[1].x, bezPoints[1].y, bezPoints[2].x, bezPoints[2].y, bezPoints[3].x, bezPoints[3].y);
    context.stroke();

    if (debug.drawBezierPoints) {
        strokePoints(lane.bezierPoints, 3, "#00ff00");
    }

    if (debug.drawLaneSegs) {
        const bridgePoints = lane.bridgePointsByTeam[TEAM.ORANGE];
        strokePoints(bridgePoints, 5, "#ff0000");
        capsulePoints(bridgePoints, params.laneWidth*0.5, 4, "#ffff00");
        dotPoints(bridgePoints, 7, "#0000ff");
        fillCircle(lane.spawns[TEAM.ORANGE], 8, "#00ff00");
        fillCircle(lane.spawns[TEAM.BLUE], 8, "#00ff00");
    }
}

export function getBoundingClientRect()
{
    return canvas.getBoundingClientRect();
}

export function draw(realTimeMs, timeDeltaMs)
{
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
        drawLane(gameState.lanes[i], gameState.player.laneSelected == i);
    }

    const { exists, team, unit, pos, angle, physState, boidState, hitState } = gameState.entities;
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
    // health bars on top!
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        drawHpBar(i);
    }
    if (debug.drawClickBridgeDebugArrow) {
        drawArrow(
            gameState.player.debugClosestLanePoint,
            gameState.player.debugClickedPoint,
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
    if (debug.drawFPS) {
        const fpsStr = `FPS: ${Number(debug.fps).toFixed(2)}`;
        drawDebugUIText(fpsStr, vec(10,20), 'white');
    }
    if (debug.drawNumUpdates) {
        const updatesStr= `updates/frame: ${Number(debug.avgUpdates).toFixed(2)}`;
        drawDebugUIText(updatesStr, vec(10,40), 'white');
    }
    drawDebugUIText("team", vec(10,60), params.teamColors[gameState.player.debugTeam]);
}

function drawDebugUIText(string, screenPos, fillStyle)
{
    context.font = "20px sans-serif";
    // draw stroke behind text so we can make a nice outline
    context.strokeStyle = 'black';
    context.setLineDash([]);
    context.lineWidth = 3;
    context.strokeText(string, screenPos.x, screenPos.y);
    context.fillStyle = fillStyle;
    context.textAlign = 'left';
    context.fillText(string, screenPos.x, screenPos.y);
}

export function init()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");
}
