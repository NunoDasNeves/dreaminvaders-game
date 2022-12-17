import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { debug, params, STATE, TEAM, ATKSTATE, weapons, units } from "./data.js";

import { enemyTeam, laneStart, laneEnd, gameState, INVALID_ENTITY_INDEX, EntityRef, spawnEntity, spawnEntityInLane, updateGameInput, initGameState, updateCameraSize, cameraToWorld, cameraVecToWorld, worldToCamera, worldVecToCamera } from './state.js'

export let canvas = null;
let context = null;

export function init()
{
    renderInit();
    initGameState();
}

function drawCircleUnit(pos, angle, team, unit)
{
    if (unit.draw.strokeColor) {
        let color = unit.draw.strokeColor;
        if (color == "TEAM") {
            color = params.teamColors[team];
        }
        strokeCircle(pos, unit.radius, 2, color);
    }
    if (unit.draw.fillColor) {
        let color = unit.draw.fillColor;
        if (color == "TEAM") {
            color = params.teamColors[team];
        }
        fillCircle(pos, unit.radius, color);
    }
}

function drawTriangleUnit(pos, angle, team, unit)
{
    let color = unit.draw.fillColor;
    if (color == "TEAM") {
        color = params.teamColors[team];
    }
    fillEquilateralTriangle(pos, angle, unit.radius, unit.radius * 1.5, color);
}

function drawUnit(pos, angle, team, unit)
{
    switch (unit.draw.shape) {
        case "circle":
            drawCircleUnit(pos, angle, team, unit);
            break;
        case "triangle":
            drawTriangleUnit(pos, angle, team, unit);
            break;
        default:
            console.error("invalid unit.draw");
            break;
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

function strokeHalfCapsule(worldPos, length, radius, angle, width, strokeStyle)
{
    const worldLineLen = length - radius;
    const dir = vecFromAngle(angle);
    const line = vecMul(dir, worldLineLen);
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

function drawRectangle(worldPos, width, height, fillStyle, fromCenter=false) {
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

function drawBase(team, base)
{
    const teamColor = params.teamColors[team];
    const coords = worldToCamera(base.pos.x, base.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, (params.baseRadius - 50) / gameState.camera.scale, coords.x, coords.y, params.baseVisualRadius / gameState.camera.scale);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, params.baseFadeColor);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, params.baseVisualRadius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fill();
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

function drawLane(lane)
{
    context.beginPath();
    let coords = worldToCamera(lane.points[0].x, lane.points[0].y);
    context.moveTo(coords.x, coords.y);

    for (let i = 1; i < lane.points.length; ++i) {
        coords = worldToCamera(lane.points[i].x, lane.points[i].y);
        context.lineTo(coords.x, coords.y);
        context.strokeStyle = params.laneColor;
        // Clear line dash
        context.setLineDash([]);
        context.lineWidth = params.laneWidth / gameState.camera.scale;
        context.stroke();
    }
}

export function render()
{
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = params.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const [team, base] of Object.entries(gameState.bases)) {
        drawBase(team, base);
    }

    for (let i = 0; i < gameState.lanes.length; ++i) {
        drawLane(gameState.lanes[i]);
    }

    const { exists, team, unit, pos, angle, physState, boidState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        drawUnit(pos[i], angle[i], team[i], unit[i]);
        if (debug.drawRadii) {
            strokeCircle(pos[i], unit[i].radius, 1, physState[i].colliding ? 'red' : '#880000');
        }
        if (debug.drawSight && unit[i].sightRadius > 0)
        {
            strokeCircle(pos[i], unit[i].sightRadius, 1, 'yellow');
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

    }
}

function renderInit()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");
}

function forAllEntities(fn)
{
    const { exists } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        fn(i);
    }
}

function nearestUnit(i, minRange, excludeFn)
{
    const { exists, unit, pos } = gameState.entities;
    let best = INVALID_ENTITY_INDEX;
    let minDist = minRange;
    // TODO broad phase
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (excludeFn(i, j)) {
            continue;
        }
        const toUnit = vecSub(pos[j], pos[i]);
        const distToUnit = vecLen(toUnit);
        const distToUnitEdge = distToUnit - unit[j].radius;
        if (distToUnitEdge < minDist) {
            best = j;
            minDist = distToUnitEdge;
        }
    }
    return new EntityRef(best);
}

function nearestEnemyInSightRadius(i)
{
    const { team, unit } = gameState.entities;
    return nearestUnit(i, unit[i].sightRadius, (j, k) => team[j] == team[k]);
}

function nearestEnemyInAttackRange(i)
{
    const { team, unit } = gameState.entities;
    return nearestUnit(i, unit[i].radius + unit[i].weapon.range, (j, k) => team[j] == team[k]);
}

// is unit i in range to attack unit j
function isInAttackRange(i, j)
{
    const { unit, pos } = gameState.entities;
    const toUnit = vecSub(pos[j], pos[i]);
    const distToUnit = vecLen(toUnit);
    const distToUnitEdge = distToUnit - unit[j].radius;
    return distToUnitEdge < (unit[i].radius + unit[i].weapon.range);
}

function canAttackTarget(i)
{
    const { exists, target } = gameState.entities;
    const targetRef = target[i];
    if (!targetRef.isValid()) {
        return false
    }
    return isInAttackRange(i, targetRef.getIndex());
}

function getCollidingWith(i)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    const colls = [];
    if (!unit[i].collides) {
        return colls;
    }
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (j == i || !unit[j].collides) {
            continue;
        }
        const dist = getDist(pos[i], pos[j]);
        if (dist < unit[i].radius + unit[j].radius) {
            colls.push(j);
        }
    }
    return colls;
}

function updateAllCollidingPairs(pairs)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    pairs.length = 0;

    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        if (!unit[i].collides) {
            continue;
        }
        for (let j = i + 1; j < exists.length; ++j) {
            if (!exists[j]) {
                continue;
            }
            if (j == i || !unit[j].collides) {
                continue;
            }
            const dist = getDist(pos[i], pos[j]);
            if (dist < unit[i].radius + unit[j].radius) {
                pairs.push([i, j]);
            }
        }
    }
    return pairs;
}

function getAvoidanceForce(i, seekForce)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState, boidState } = gameState.entities;
    const bState = boidState[i];

    vecClear(bState.avoidanceForce);
    if (vecAlmostZero(vel[i])) {
        bState.avoidDir = 0;
        bState.avoiding = false;
        return bState.avoidanceForce;
    }
    const goingDir = seekForce;
    // find closest thing to avoid
    let minAvoid = -1; // boid to avoid
    let minDist = Infinity; // dist to edge of boid to avoid
    let minToBoid = vec(); // vector to boid to avoid
    const lineDir = vecNorm(goingDir);
    // the capsule that is our avoidance 'sight'
    const capsuleLen = unit[i].sightRadius;
    //  the line in the center of the capsule, from our center to the center of the circle on the end
    const lineLen = capsuleLen - unit[i].radius;
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (unit[j] != units.boid) {
            continue;
        }
        if (i == j) {
            continue;
        }
        const toBoid = vecSub(pos[j], pos[i]);
        // len from our center to their edge
        const len = vecLen(toBoid) - unit[j].radius;
        // TODO don't try to avoid target[i]; we wanna go straight towards it
        // can see it
        if (len > unit[i].sightRadius) {
            continue;
        }
        // it's in front
        if (vecDot(lineDir, toBoid) < 0) {
            continue;
        }
        // half capsule check - capsule has unit[i].radius
        // project toBoid onto line forward
        const distAlongLine = vecDot(toBoid, lineDir);
        if (distAlongLine > lineLen) {
            // its in the capsule end
            const endOfLine = vecMul(lineDir, lineLen);
            if (getDist(endOfLine, toBoid) > (unit[i].radius + unit[j].radius)) {
                continue;
            }
        } else {
            // its in the line part, not the end part
            const closestPointOnLine = vecMul(lineDir, distAlongLine);
            if (getDist(closestPointOnLine, toBoid) > unit[i].radius + unit[j].radius) {
                continue;
            }
        }
        if (len < minDist) {
            minAvoid = j;
            minDist = len;
            minToBoid = toBoid;
        }
    }
    // time to avoid
    if (minAvoid != -1) {
        bState.avoiding = true;
        // get the direction
        const avoidForce = vecTangentRight(lineDir);
        // use old avoid direction so we don't pingpong frame-to-frame
        if (bState.avoidDir == 0) {
            bState.avoidDir = vecScalarCross(minToBoid, lineDir) > 0 ? -1 : 1;
        }
        vecMulBy(avoidForce, bState.avoidDir);
        // force is inversely proportional to forward dist (further away = avoid less)
        vecMulBy(avoidForce, 1 - minDist/capsuleLen);
        vecCopyTo(bState.avoidanceForce, avoidForce);
    } else {
        bState.avoiding = false;
        bState.avoidDir = 0;
    }
    return vecMulBy(bState.avoidanceForce, unit[i].speed);
}

function getSeparationForce(i)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState, boidState } = gameState.entities;
    const bState = boidState[i];
    const separationForce = vec();
    let separationCount = 0;
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (unit[j] != units.boid) {
            continue;
        }
        if (i == j) {
            continue;
        }
        const separationRadius = unit[i].radius + unit[j].radius;
        const dist = getDist(pos[i], pos[j]);
        if (dist > separationRadius) {
            continue;
        }
        const dir = vecMul(vecSub(pos[i], pos[j]), 1/dist);
        const force = vecMul(dir, separationRadius - dist);
        vecAddTo(separationForce, force);
        separationCount++;
    }
    if (separationCount > 0) {
        vecMulBy(separationForce, 1/separationCount);
    }

    return separationForce;
}

function updateBoidState()
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState, boidState } = gameState.entities;
    const basePositions = [gameState.bases[TEAM.BLUE].pos, gameState.bases[TEAM.ORANGE].pos];
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        if (unit[i] != units.boid) {
            continue;
        }
        const bState = boidState[i];
        if (bState.targetPos != null) {
            if (utils.getDist(pos[i], bState.targetPos) < (params.baseRadius + 5)) {
                bState.targetPos = null;
            }
        }
        if (bState.targetPos == null) {
            bState.targetPos = basePositions.reduce((acc, v) => {
                const d = getDist(v, pos[i]);
                return d > acc[1] ? [v, d] : acc;
            }, [pos[i], 0])[0];
        }
        const toTargetPos = vecSub(bState.targetPos, pos[i]);
        const targetDir = vecNorm(toTargetPos);
        const seekForce = vecMul(targetDir, unit[i].speed);
        bState.seekForce = seekForce;
        const finalForce = vecClone(seekForce);
        const avoidanceForce = getAvoidanceForce(i, seekForce);

        vecAddTo(finalForce, avoidanceForce);
        vecSetMag(finalForce, unit[i].speed);
        vecCopyTo(vel[i], finalForce);
    }
}

function updateUnitState()
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;

    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        if (state[i] == STATE.DO_NOTHING) {
            continue;
        }
        const toEnemyBase = vecSub(gameState.bases[enemyTeam(team[i])].pos, pos[i]);
        const distToEnemyBase = vecLen(toEnemyBase);
        //const toEndOfLane = vecSub(laneEnd(lane[i], team[i]), pos[i]);
        //const distToEndOfLane = vecLen(toEndOfLane);
        const nearestAtkTarget = nearestEnemyInAttackRange(i);
        const nearestChaseTarget = nearestEnemyInSightRadius(i);
        // change state
        switch (state[i]) {
            case STATE.PROCEED:
            {
                if (distToEnemyBase < unit[i].radius) {
                    state[i] = STATE.DO_NOTHING;
                    vecClear(vel[i]);
                    break;
                }
                if (nearestAtkTarget.isValid()) {
                    state[i] = STATE.ATTACK;
                    target[i] = nearestAtkTarget;
                } else if (nearestChaseTarget.isValid()) {
                    state[i] = STATE.CHASE;
                    target[i] = nearestChaseTarget;
                }
                break;
            }
            case STATE.CHASE:
            {
                // switch to attack if in range
                if (nearestAtkTarget.isValid()) {
                    state[i] = STATE.ATTACK;
                    target[i] = nearestAtkTarget;
                    atkState[i].timer = unit[i].weapon.aimMs;
                    atkState[i].state = ATKSTATE.AIM;

                // otherwise always chase nearest
                } else if (nearestChaseTarget.isValid()) {
                    target[i] = nearestChaseTarget;

                // otherwise... continue on
                } else {
                    state[i] = STATE.PROCEED;
                }
                break;
            }
            case STATE.ATTACK:
            {
                // check we can still attack the current target
                if (!canAttackTarget(i)) {
                    target[i].invalidate();
                }
                /*
                 * If we can't attack the current target, target[i] is invalid;
                 * Try to pick a new target, or start chasing
                 */
                if (!target[i].isValid()) {
                    if (nearestAtkTarget.isValid()) {
                        target[i] = nearestAtkTarget;
                        atkState[i].timer = unit[i].weapon.aimMs;
                        atkState[i].state = ATKSTATE.AIM;

                    } else if (nearestChaseTarget.isValid()) {
                        state[i] = STATE.CHASE;
                        target[i] = nearestChaseTarget;

                    } else {
                        state[i] = STATE.PROCEED;
                    }
                }
                break;
            }
        }
        // make decisions based on state
        switch (state[i]) {
            case STATE.PROCEED:
            {
                const dir = vecNorm(toEnemyBase);
                vel[i] = vecMul(dir, Math.min(unit[i].speed, distToEnemyBase));
                target[i].invalidate();
                atkState[i].state = ATKSTATE.NONE;
                break;
            }
            case STATE.CHASE:
            {
                const t = target[i].getIndex();
                console.assert(t != INVALID_ENTITY_INDEX);
                const toTarget = vecSub(pos[t], pos[i]);
                const distToTarget = vecLen(toTarget);
                if ( !almostZero(distToTarget) ) {
                    const dir = vecMul(toTarget, 1/distToTarget);
                    vel[i] = vecMul(dir, Math.min(unit[i].speed, distToTarget));
                }
                break;
            }
            case STATE.ATTACK:
            {
                const t = target[i].getIndex();
                console.assert(t != INVALID_ENTITY_INDEX);
                vecClear(vel[i]); // stand still
            }
            break;
        }
    }
}

function keyPressed(k)
{
    return gameState.input.keyMap[k] && !gameState.lastInput.keyMap[k];
}

function updatePhysicsState()
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;

    // very simple collisions, just reset position
    const pairs = [];
    // move, collide
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        physState[i].colliding = false;
        vecAddTo(pos[i], vel[i]);
    };

    updateAllCollidingPairs(pairs);
    for (let k = 0; k < pairs.length; ++k) {
        const [i, j] = pairs[k];
        physState[i].colliding = true;
        physState[j].colliding = true;
        const dir = vecSub(pos[j],pos[i]);
        const len = vecLen(dir);
        const correction = (unit[i].radius + unit[j].radius - len) / 2;
        if ( almostZero(len) ) {
            dir = vec(1,0);
        } else {
            vecMulBy(dir, 1/len);
        }
        const dirNeg = vecMul(dir, -1);
        const corrPos = vecMul(dir, correction);
        const corrNeg = vecMul(dirNeg, correction);

        vecAddTo(pos[i], corrNeg);
        vecAddTo(pos[j], corrPos);
    }

    // rotate to face vel
    forAllEntities((i) => {
        if (vecLen(vel[i]) > params.minUnitVelocity) {
            angle[i] = vecToAngle(vel[i]);
        }
    });
}

function updateGame(timeDeltaMs)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;

    updatePhysicsState();

    // attack state
    forAllEntities((i) => {
        const newTime = atkState[i].timer - timeDeltaMs;
        if (newTime > 0) {
            atkState[i].timer = newTime;
            return;
        }
        // timer has expired
        switch (atkState[i].state) {
            case ATKSTATE.NONE:
            {
                atkState[i].timer = 0;
                break;
            }
            case ATKSTATE.AIM:
            {
                atkState[i].state = ATKSTATE.SWING;
                atkState[i].timer = newTime + unit[i].weapon.swingMs; // there may be remaining negative time; remove that from the timer by adding here
                break;
            }
            case ATKSTATE.SWING:
            {
                atkState[i].state = ATKSTATE.RECOVER;
                atkState[i].timer = newTime + unit[i].weapon.recoverMs;
                // hit!
                if (canAttackTarget(i) && Math.random() > unit[i].weapon.missChance) {
                    const t = target[i].getIndex();
                    console.assert(t != INVALID_ENTITY_INDEX);
                    hp[t] -= unit[i].weapon.damage;
                }
                break;
            }
            case ATKSTATE.RECOVER:
            {
                atkState[i].state = ATKSTATE.AIM;
                atkState[i].timer = newTime + unit[i].weapon.aimMs;
                break;
            }
        }
    });

    // state/AI
    updateUnitState();
    updateBoidState();

    // reap/spawn
    // TODO bug - an entity who is referenced by another (e.g. by target) could die (exists = false), then another could spawn in the same spot (setting exists = true)
    forAllEntities((i) => {
        if (hp[i] <= 0) {
            exists[i] = false;
            // add to free list
            gameState.entities.nextFree[i] = gameState.freeSlot;
            gameState.freeSlot = i;
        }
    });
}

export function update(realTimeMs, __ticksMs /* <- don't use this unless we fix debug pause */, timeDeltaMs)
{
    updateCameraSize(canvas.width, canvas.height);

    // TODO this will mess up ticksMs if we ever use it for anything, so don't for now
    if (keyPressed('p')) {
        gameState.debugPause = !gameState.debugPause;
    }
    if (gameState.debugPause) {
        // frame advance
        if (!keyPressed('.')) {
        }
    }

    if (keyPressed('q')) {
        spawnEntityInLane(gameState.lanes[0], TEAM.ORANGE, units.circle);
    }
    if (keyPressed('w')) {
        spawnEntityInLane(gameState.lanes[0], TEAM.BLUE, units.circle);
    }
    if (keyPressed('e')) {
        spawnEntity(gameState.input.mousePos, TEAM.BLUE, units.boid);
    }
    if (keyPressed('r')) {
        spawnEntity(gameState.input.mousePos, TEAM.ORANGE, units.boid);
    }
    // camera controls
    gameState.camera.scale = clamp(gameState.camera.scale + gameState.input.mouseScrollDelta, 0.1, 5);
    if (gameState.input.mouseMiddle) {
        const delta = vecMul(vecSub(gameState.input.mouseScreenPos, gameState.lastInput.mouseScreenPos), gameState.camera.scale);
        if (vecLen(delta)) {
            vecSubFrom(gameState.camera.pos, delta);
        }
    }

    if (!gameState.debugPause || keyPressed('.')) {
        updateGame(timeDeltaMs);
    }

    updateGameInput();
}
