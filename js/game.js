import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { debug, params, AISTATE, TEAM, HITSTATE, ATKSTATE, weapons, units } from "./data.js";
import { enemyTeam, laneStart, laneEnd, gameState, INVALID_ENTITY_INDEX, EntityRef, spawnEntity, spawnEntityInLane, updateGameInput, initGameState, cameraToWorld, cameraVecToWorld, worldToCamera, worldVecToCamera } from './state.js'

/*
 * Game init and update functions
 */

export function init()
{
    initGameState();
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

function nearestUnit(i, minRange, filterFn)
{
    const { exists, unit, pos } = gameState.entities;
    let best = INVALID_ENTITY_INDEX;
    let minDist = minRange;
    // TODO broad phase
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (!filterFn(i, j)) {
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

function isAliveAndNotOnMyTeam(myIdx, theirIdx)
{
    const { team, hitState } = gameState.entities;
    return hitState[theirIdx].state == HITSTATE.ALIVE && team[myIdx] != team[theirIdx];
}

function nearestEnemyInSightRadius(i)
{
    const { unit } = gameState.entities;
    return nearestUnit(i, unit[i].sightRadius, isAliveAndNotOnMyTeam );
}

function nearestEnemyInAttackRange(i)
{
    const { unit } = gameState.entities;
    return nearestUnit(i, unit[i].radius + unit[i].weapon.range, isAliveAndNotOnMyTeam);
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
    const { target, hitState } = gameState.entities;
    const targetRef = target[i];
    const t = targetRef.getIndex();
    if (t == INVALID_ENTITY_INDEX) {
        return false
    }
    return hitState[t].state == HITSTATE.ALIVE && isInAttackRange(i, t);
}

function getCollidingWith(i)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    const colls = [];
    if (!physState[i].canCollide) {
        return colls;
    }
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (j == i || !physState[j].canCollide) {
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
        if (!physState[i].canCollide) {
            continue;
        }
        for (let j = i + 1; j < exists.length; ++j) {
            if (!exists[j]) {
                continue;
            }
            if (j == i || !physState[j].canCollide) {
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

function updateAiState()
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, aiState, atkState, physState } = gameState.entities;

    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        if (aiState[i].state == AISTATE.DO_NOTHING) {
            continue;
        }
        const toEnemyBase = vecSub(gameState.bases[enemyTeam(team[i])].pos, pos[i]);
        const distToEnemyBase = vecLen(toEnemyBase);
        //const toEndOfLane = vecSub(laneEnd(lane[i], team[i]), pos[i]);
        //const distToEndOfLane = vecLen(toEndOfLane);
        const nearestAtkTarget = nearestEnemyInAttackRange(i);
        const nearestChaseTarget = nearestEnemyInSightRadius(i);
        switch (aiState[i].state) {
            case AISTATE.PROCEED:
            {
                if (distToEnemyBase < unit[i].radius) {
                    aiState[i].state = AISTATE.DO_NOTHING;
                    vecClear(vel[i]);
                    break;
                }
                if (nearestAtkTarget.isValid()) {
                    aiState[i].state = AISTATE.ATTACK;
                    target[i] = nearestAtkTarget;
                } else if (nearestChaseTarget.isValid()) {
                    aiState[i].state = AISTATE.CHASE;
                    target[i] = nearestChaseTarget;
                }
                break;
            }
            case AISTATE.CHASE:
            {
                // switch to attack if in range
                if (nearestAtkTarget.isValid()) {
                    aiState[i].state = AISTATE.ATTACK;
                    target[i] = nearestAtkTarget;
                    atkState[i].timer = unit[i].weapon.aimMs;
                    atkState[i].state = ATKSTATE.AIM;

                // otherwise always chase nearest
                } else if (nearestChaseTarget.isValid()) {
                    target[i] = nearestChaseTarget;

                // otherwise... continue on
                } else {
                    aiState[i].state = AISTATE.PROCEED;
                }
                break;
            }
            case AISTATE.ATTACK:
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
                        aiState[i].state = AISTATE.CHASE;
                        target[i] = nearestChaseTarget;

                    } else {
                        aiState[i].state = AISTATE.PROCEED;
                    }
                }
                break;
            }
        }
        // make decisions based on state
        switch (aiState[i].state) {
            case AISTATE.PROCEED:
            {
                const dir = vecNorm(toEnemyBase);
                vel[i] = vecMul(dir, Math.min(unit[i].speed, distToEnemyBase));
                target[i].invalidate();
                atkState[i].state = ATKSTATE.NONE;
                break;
            }
            case AISTATE.CHASE:
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
            case AISTATE.ATTACK:
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
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, aiState, atkState, physState, hitState } = gameState.entities;

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

    // rotate to face vel. also check for falling
    forAllEntities((i) => {
        if (vecLen(vel[i]) > params.minUnitVelocity) {
            angle[i] = vecToAngle(vel[i]);
        }
        if (physState[i].canFall && hitState[i].state == HITSTATE.ALIVE) {
            const laneStartPos = laneStart(lane[i], team[i]);
            const laneLine = vecSub(laneEnd(lane[i], team[i]), laneStartPos);
            const laneLen = vecLen(laneLine);
            const laneStartToEnt = vecSub(pos[i], laneStartPos);
            const laneDir = vecMul(laneLine, 1/laneLen);
            const distAlongLane = vecDot(laneDir, laneStartToEnt);
            const inLine = distAlongLane > 0 && distAlongLane < laneLen;
            const closestPoint = vecMul(laneDir, distAlongLane);
            if (inLine && getDist(closestPoint, laneStartToEnt) >= params.laneWidth*0.5) {
                // TODO push it with a force, don't just teleport
                const dirAwayFromLane = vecNormalize(vecSub(laneStartToEnt, closestPoint));
                vecAddTo(pos[i], vecMulBy(dirAwayFromLane, unit[i].radius));
                // fade hpTimer fast
                if (hitState[i].hpBarTimer > 0) {
                    hitState[i].hpBarTimer = params.deathTimeMs*0.5;
                }
                hitState[i].fallTimer = params.fallTimeMs;
                hitState[i].deadTimer = params.deathTimeMs;
                hitState[i].state = HITSTATE.DEAD;
                aiState[i].state = AISTATE.DO_NOTHING;
                atkState[i].state = ATKSTATE.NONE;
                physState[i].canCollide = false;
                vecClear(vel[i]);
            }
        }
    });
}

function hitEntity(i, damage)
{
    const { unit, hp, hitState } = gameState.entities;
    hp[i] -= damage;
    hitState[i].hitTimer = params.hitFadeTimeMs;
    hitState[i].hpBarTimer = params.hpBarTimeMs;
}

function updateHitState(timeDeltaMs)
{
    const { freeable, vel, hp, aiState, atkState, hitState, physState } = gameState.entities;
    forAllEntities((i) => {
        hitState[i].hitTimer = Math.max(hitState[i].hitTimer - timeDeltaMs, 0);
        hitState[i].hpBarTimer = Math.max(hitState[i].hpBarTimer - timeDeltaMs, 0);

        switch (hitState[i].state) {
            case HITSTATE.ALIVE:
            {
                if (hp[i] <= 0) {
                    // fade hpTimer fast
                    if (hitState[i].hpBarTimer > 0) {
                        hitState[i].hpBarTimer = params.deathTimeMs*0.5;
                    }
                    hitState[i].deadTimer = params.deathTimeMs;
                    hitState[i].state = HITSTATE.DEAD;
                    aiState[i].state = AISTATE.DO_NOTHING;
                    atkState[i].state = ATKSTATE.NONE;
                    physState[i].canCollide = false;
                    vecClear(vel[i]);
                }
                break;
            }
            case HITSTATE.DEAD:
            {
                if (hitState[i].fallTimer > 0) {
                    hitState[i].fallTimer -= timeDeltaMs;
                }
                hitState[i].deadTimer -= timeDeltaMs;
                if (hitState[i].deadTimer <= 0) {
                    freeable[i] = true;
                }
                break;
            }
        }
    });
}

function updateAtkState(timeDeltaMs)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;

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
                    hitEntity(i, unit[i].weapon.damage);
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
}

function updateGame(timeDeltaMs)
{
    const { exists, freeable } = gameState.entities;

    // order here matters!
    updatePhysicsState();
    updateAtkState(timeDeltaMs);
    updateAiState();

    // to remove/factor out
    updateBoidState();

    // this should come right before reap
    updateHitState(timeDeltaMs);
    // reap freeable entities
    for (let i = 0; i < exists.length; ++i) {
        if (exists[i] && freeable[i]) {
            exists[i] = false;
            // add to free list
            gameState.entities.nextFree[i] = gameState.freeSlot;
            gameState.freeSlot = i;
        }
    };
}

export function update(realTimeMs, __ticksMs /* <- don't use this unless we fix debug pause */, timeDeltaMs)
{
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
