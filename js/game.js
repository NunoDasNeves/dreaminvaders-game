import * as Utils from "./util.js";
import * as Data from "./data.js";
import * as State from "./state.js";
import * as App from './app.js';
import * as UI from './UI.js';
import * as Music from './music.js';
import { assets } from "./assets.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);

/*
 * Game init and update functions
 */

export function init(config)
{
    initGameState(config);
}

function forAllUnits(fn)
{
    const { exists } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        fn(i);
    }
}

function nearestUnitToPos(point, maxRange, filterFn)
{
    const { exists, pos } = gameState.entities;
    let best = INVALID_ENTITY_INDEX;
    let minDist = maxRange;
    // TODO broad phase
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        if (!filterFn(i)) {
            continue;
        }
        const toUnit = vecSub(pos[i], point);
        const dist = vecLen(toUnit);
        if (dist < minDist) {
            best = i;
            minDist = dist;
        }
    }
    return new EntityRef(best);
}

function nearestUnit(i, minRange, filterFn)
{
    const { exists, unit, pos } = gameState.entities;
    let best = INVALID_ENTITY_INDEX;
    let minDist = minRange;
    // TODO broad phase
    for (let j = 0; j < exists.length; ++j) {
        if (!entityExists(j, ENTITY.UNIT)) {
            continue;
        }
        if (!filterFn(i, j)) {
            continue;
        }
        const toUnit = vecSub(pos[j], pos[i]);
        const distToUnit = vecLen(toUnit);
        const distToUse = distToUnit - unit[j].radius - unit[i].radius;
        if (distToUse < minDist) {
            best = j;
            minDist = distToUse;
        }
    }
    return new EntityRef(best);
}

function canChaseOrAttack(myIdx, theirIdx)
{
    const { unit, pos, team, playerId, lane, laneIdx, hitState } = gameState.entities;
    // only units can attack/chase each other
    if (!entityExists(myIdx, ENTITY.UNIT) || !entityExists(theirIdx, ENTITY.UNIT)) {
        return false;
    }
    // ignore bases, towers, souls...
    if (!unit[theirIdx].targettable) {
        return false;
    }
    if (hitState[theirIdx].state != HITSTATE.ALIVE) {
        return false;
    }
    if (team[myIdx] == team[theirIdx]) {
        return false;
    }
    // ignore if they're already too far into our island
    if (playerId[myIdx] != null && laneIdx[myIdx] != null) {
        const myIsland = gameState.islands[playerId[myIdx]];
        if (    getDist(pos[theirIdx], myIsland.pos) < params.laneDistFromBase &&
                getDist(pos[theirIdx], lane[myIdx].spawnPos) > params.spawnPlatRadius) {
            return false;
        }
    }
    // ignore units in other lanes
    if (laneIdx[myIdx] != null && laneIdx[theirIdx] != null) {
        if (laneIdx[theirIdx] != laneIdx[myIdx]) {
            return false;
        }
    }
    return true;
}

function nearestEnemyInSightRange(i)
{
    const { unit } = gameState.entities;
    return nearestUnit(i, unit[i].sightRange, canChaseOrAttack);
}

function nearestEnemyInAttackRange(i)
{
    const { unit } = gameState.entities;
    return nearestUnit(i, getUnitWeapon(unit[i]).range, canChaseOrAttack);
}

// is unit i in range to attack unit j
function isInAttackRange(i, j)
{
    const { unit, pos } = gameState.entities;
    const toUnit = vecSub(pos[j], pos[i]);
    const distToUnit = vecLen(toUnit);
    const distForAttacking = Math.max(distToUnit - unit[j].radius - unit[i].radius, 0);
    return distForAttacking < getUnitWeapon(unit[i]).range;
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
        if (!entityExists(j, ENTITY.UNIT)) {
            continue;
        }
        if (j == i || !physState[j].canCollide) {
            continue;
        }
        const dist = getDist(pos[i], pos[j]);
        if (dist < physState[i].collRadius + physState[j].collRadius) {
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
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        if (!physState[i].canCollide) {
            continue;
        }
        for (let j = i + 1; j < exists.length; ++j) {
            if (!entityExists(j, ENTITY.UNIT)) {
                continue;
            }
            if (j == i || !physState[j].canCollide) {
                continue;
            }
            const dist = getDist(pos[i], pos[j]);
            if (dist < physState[i].collRadius + physState[j].collRadius) {
                pairs.push([i, j]);
            }
        }
    }
    return pairs;
}

function getDecelVec(vel, maxAccel)
{
    const velLen = vecLen(vel);
    // accel to inverse of vel; ensures we don't undershoot and go backwards if vel is small
    const decelVec = vecMul(vel, -1);
    // common case; cap deceleration at maxAccel
    if (velLen > maxAccel) {
        vecSetMag(decelVec, maxAccel);
    }
    return decelVec;
}

function decel(i)
{
    const { vel, accel, maxAccel } = gameState.entities;
    accel[i] = getDecelVec(vel[i], maxAccel[i]);
}

function accelUnitAwayFromEdge(i)
{
    const { unit, laneIdx, team, pos, accel, maxAccel } = gameState.entities;
    const bridgePoints = gameState.bridges[laneIdx[i]].bridgePoints;
    const { dir, dist } = pointNearLineSegs(pos[i], bridgePoints);
    const distUntilFall = params.laneWidth*0.5 - dist;
    if (distUntilFall < unit[i].radius) {
        const x =  clamp(distUntilFall / unit[i].radius, 0, 1);
        // smoothstep
        const a = x * x * (3 - 2 * x);
        const fullIn = vecMul(dir, -maxAccel[i]);
        const inVec = vecMul(fullIn, 1 - a);
        const stayVec = vecMul(accel[i], a);
        const result = vecAdd(inVec, stayVec);
        vecCopyTo(accel[i], result);
        vecClampMag(accel[i], 0, maxAccel[i]);
    }
}

function startAtk(i, targetRef)
{
    const { aiState, target, atkState } = gameState.entities;
    aiState[i].state = AISTATE.ATTACK;
    atkState[i].state = ATKSTATE.AIM;
    target[i] = targetRef;
}

// get direction of the closest bridge line segment, toward target pos
function getDirAlongBridge(pos, bridgePoints, targetPos)
{
    const lastIdx = bridgePoints.length - 1;
    console.assert(lastIdx > 0);
    const { baseIdx, point, dir, dist } = pointNearLineSegs(pos, bridgePoints);
    console.assert(baseIdx < lastIdx);
    const basePoint = bridgePoints[baseIdx];
    const nextIdx = baseIdx + 1;
    const nextPoint = bridgePoints[nextIdx];
    const dirAlongBridge = vecNormalize(vecSub(nextPoint, basePoint));
    const posToTarget = vecSub(targetPos, pos);

    if (vecDot(posToTarget, dirAlongBridge) < 0) {
        // go backwards instead of forwards
        vecNegate(dirAlongBridge);
    }

    return dirAlongBridge;
}

function updateUnitAiProceedAttack(i)
{
    const { playerId, unit, pos, vel, accel, maxAccel, lane, laneIdx, target, aiState, atkState, debugState } = gameState.entities;
    const player = gameState.players[playerId[i]];
    // assumption all lanes lead to same enemy for units without a lane
    const laneToEnemy = lane[i] != null ? lane[i] : player.island.lanes[0];
    const enemyIsland = gameState.players[laneToEnemy.otherPlayerIdx].island;
    const enemyLighthousePos = pos[enemyIsland.idx];
    const distToEnemyIsland = getDist(pos[i], enemyIsland.pos);
    const toEnemyLighthouse = vecSub(enemyLighthousePos, pos[i]);
    const distToEnemyLighthouse = vecLen(toEnemyLighthouse);
    const nearestAtkTarget = nearestEnemyInAttackRange(i);
    const nearestChaseTarget = nearestEnemyInSightRange(i);
    const weapon = getUnitWeapon(unit[i]);

    switch (aiState[i].state) {
        case AISTATE.PROCEED:
        {
            if (distToEnemyLighthouse < unit[i].radius) {
                aiState[i].state = AISTATE.IDLE;
                break;
            }
            if (distToEnemyIsland < (params.laneDistFromBase + params.spawnPlatRadius)) {
                // keep proceeding
            } else if (nearestAtkTarget.isValid()) {
                startAtk(i, nearestAtkTarget);
            } else if (nearestChaseTarget.isValid()) {
                aiState[i].state = AISTATE.CHASE;
                target[i] = nearestChaseTarget;
            }
            break;
        }
        case AISTATE.CHASE:
        {
            // switch to attack if in range (and mostly stopped)
            // units can get stuck partially off the edge without
            // their vel going to almostZero, so this kinda fixes that
            const mostlyStopped = vecLen(vel[i]) < (unit[i].topSpeed * 0.5);
            if (nearestAtkTarget.isValid() && mostlyStopped) {
                startAtk(i, nearestAtkTarget);
            // otherwise always chase nearest
            } else if (nearestChaseTarget.isValid()) {
                target[i] = nearestChaseTarget;
            // otherwise... continue on
            } else {
                aiState[i].state = unit[i].defaultAiState;
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
                * let recovery animation play, then pick a new target or chase
                */
            if (!target[i].isValid() && atkState[i].state != ATKSTATE.RECOVER) {
                if (nearestAtkTarget.isValid()) {
                    startAtk(i, nearestAtkTarget);
                } else if (nearestChaseTarget.isValid()) {
                    aiState[i].state = AISTATE.CHASE;
                    target[i] = nearestChaseTarget;

                } else {
                    aiState[i].state = unit[i].defaultAiState;
                }
            }
            break;
        }
    }
    // do stuff based on state
    switch (aiState[i].state) {
        case AISTATE.PROCEED:
        {
            const bridgePoints = gameState.bridges[laneIdx[i]].bridgePoints;
            if (isOnEnemyIsland(i)) {
                // go to enemy lighthouse
                const goDir = vecNormalize(vecSub(enemyLighthousePos, pos[i]));
                accel[i] = vecMul(goDir, maxAccel[i]);
            } else {
                const goDir = getDirAlongBridge(pos[i], bridgePoints, enemyLighthousePos);
                accel[i] = vecMul(goDir, maxAccel[i]);
                accelUnitAwayFromEdge(i);
            }
            target[i].invalidate();
            playUnitAnim(i, ANIM.WALK);
            break;
        }
        case AISTATE.CHASE:
        {
            const t = target[i].getIndex();
            console.assert(t != INVALID_ENTITY_INDEX);
            const toTarget = vecSub(pos[t], pos[i]);
            const distToTarget = vecLen(toTarget);
            if (almostZero(distToTarget)) {
                decel(i);
                accelUnitAwayFromEdge(i);
                break;
            }
            const rangeToTarget = distToTarget - unit[i].radius - unit[t].radius;
            const desiredRange = weapon.range;
            const distToDesired = rangeToTarget - desiredRange;
            if (distToDesired < 0) {
                decel(i);
                accelUnitAwayFromEdge(i);
                break;
            }
            const dirToTarget = vecNorm(toTarget, 1/distToTarget);
            const velTowardsTarget = vecDot(vel[i], dirToTarget);
            // compute the approximate stopping distance
            // ...these are kinematic equations of motion!
            // underestimate the time it takes to stop by a frame
            const stopFrames = Math.ceil(velTowardsTarget / maxAccel[i] - 1); // v = v_0 + at, solve for t
            const stopRange = ( velTowardsTarget + 0.5*maxAccel[i]*stopFrames ) * stopFrames; // dx = v_0t + 1/2at^2
            debugState[i].stopRange = vecMul(dirToTarget, stopRange);
            if ( distToDesired > stopRange ) {
            accel[i] = vecMul(dirToTarget, Math.min(maxAccel[i], distToDesired));
                debugState[i].stopping = false;
            } else {
                debugState[i].stopping = true;
                decel(i);
            }
            accelUnitAwayFromEdge(i);
            playUnitAnim(i, ANIM.WALK);
            break;
        }
        case AISTATE.ATTACK:
        {
            const t = target[i].getIndex();
            console.assert(t != INVALID_ENTITY_INDEX || atkState[i].state == ATKSTATE.RECOVER);
            decel(i); // stand still
            playUnitAnim(i, ANIM.ATK);
        }
        break;
    }
}

function updateUnitAiIdleAttack(i)
{
    const { playerId, unit, pos, vel, accel, maxAccel, lane, target, aiState, atkState, debugState } = gameState.entities;
    const player = gameState.players[playerId[i]];
    // assumption all lanes lead to same enemy for units without a lane
    const laneToEnemy = lane[i] != null ? lane[i] : player.island.lanes[0];
    const enemyIsland = gameState.players[laneToEnemy.otherPlayerIdx].island;
    const enemyLighthousePos = pos[enemyIsland.idx];
    const distToEnemyIsland = getDist(pos[i], enemyIsland.pos);
    const toEnemyLighthouse = vecSub(enemyLighthousePos, pos[i]);
    const distToEnemyLighthouse = vecLen(toEnemyLighthouse);
    const nearestAtkTarget = nearestEnemyInAttackRange(i);
    const nearestChaseTarget = nearestEnemyInSightRange(i);
    const weapon = getUnitWeapon(unit[i]);

    switch (aiState[i].state) {
        case AISTATE.IDLE:
        {
            if (nearestAtkTarget.isValid()) {
                startAtk(i, nearestAtkTarget);
            } else if (nearestChaseTarget.isValid()) {
                aiState[i].state = AISTATE.CHASE;
                target[i] = nearestChaseTarget;
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
                * let recovery animation play, then pick a new target or chase
                */
            if (!target[i].isValid() && atkState[i].state != ATKSTATE.RECOVER) {
                if (nearestAtkTarget.isValid()) {
                    startAtk(i, nearestAtkTarget);
                } else if (nearestChaseTarget.isValid()) {
                    aiState[i].state = AISTATE.CHASE;
                    target[i] = nearestChaseTarget;

                } else {
                    aiState[i].state = unit[i].defaultAiState;
                }
            }
            break;
        }
    }
    // do stuff based on state
    switch (aiState[i].state) {
        case AISTATE.IDLE: {
            decel(i);
            playUnitAnim(i, ANIM.IDLE);
            break;
        }
        case AISTATE.ATTACK:
        {
            const t = target[i].getIndex();
            console.assert(t != INVALID_ENTITY_INDEX || atkState[i].state == ATKSTATE.RECOVER);
            decel(i); // stand still
            playUnitAnim(i, ANIM.ATK);
        }
        break;
    }
}

function updateUnitAiReturnToBase(i)
{
    const { playerId, unit, pos, vel, accel, maxAccel, laneIdx, target, aiState, atkState, debugState } = gameState.entities;
    const player = gameState.players[playerId[i]];
    const lighthousePos = pos[player.island.idx];
    // go toward lighthouse
    let goDir = vecNormalize(vecSub(lighthousePos, pos[i]));
    // but follow the bridge if not on our island
    const onOwnIsland = isOnOwnIsland(i);
    if (!onOwnIsland) {
        const bridgePoints = gameState.bridges[laneIdx[i]].bridgePoints;
        goDir = getDirAlongBridge(pos[i], bridgePoints, lighthousePos);
    }
    accel[i] = vecMul(goDir, maxAccel[i]);

    if (!onOwnIsland) {
        accelUnitAwayFromEdge(i);
    }
}

function getStopDistance(currentVel, constantDecel) {
    // don't assume direction of currentVel or constantDecel
    const v_0 = Math.abs(currentVel);
    const a = Math.abs(constantDecel);
    // its just v_t^2 = v_0^2 + 2*a*d, where v_t is 0
    return v_0 * v_0 * 0.5 / a;
}

function updateUnitAiDreamer(i)
{
    const { playerId, unit, pos, vel, accel, maxAccel, laneIdx, target, aiState } = gameState.entities;
    const { dreamer, middlePos } = gameState.bridges[laneIdx[i]];
    const targetPos = dreamer.targetPos;
    const toTarget = vecSub(targetPos, pos[i]);
    if (vecAlmostZero(toTarget)) {
        return;
    }
    // TODO this can prob be less complicated because targetPos is in center of lane now
    if (Math.abs(targetPos.x - pos[i].x) < 64) {
        // if almost there in x direction, correct in all axes...
        const dist = vecLen(toTarget);
        const dirToTarget = vecMul(toTarget, 1/dist);
        // just go there by default
        accel[i] = vecMul(dirToTarget, maxAccel[i]);

        // check if we should smoothly come to a stop instead
        const velTowardsTarget = vecDot(vel[i], dirToTarget);
        if (velTowardsTarget > 0) { // make sure we're moving toward the target already
            const stopDist = getStopDistance(velTowardsTarget, maxAccel[i]);
            console.assert(stopDist >= 0);
            if (dist <= stopDist || dist < 4) {
                decel(i);
            }
        }
    } else {
        const goDir = getDirAlongBridge(pos[i], gameState.bridges[laneIdx[i]].bridgePoints, targetPos);
        accel[i] = vecMul(goDir, maxAccel[i]);
    }
    // should keep it pretty centered in lane due to large radius
    accelUnitAwayFromEdge(i);
}

const aiBehaviorToUpdateFn = {
    [AIBEHAVIOR.DO_NOTHING]: (i) => {},
    [AIBEHAVIOR.IDLE_AND_ATTACK]: updateUnitAiIdleAttack,
    [AIBEHAVIOR.PROCEED_AND_ATTACK]: updateUnitAiProceedAttack,
    [AIBEHAVIOR.RETURN_TO_BASE]: updateUnitAiReturnToBase,
    [AIBEHAVIOR.DREAMER]: updateUnitAiDreamer,
};

function updateUnitAiState()
{
    const { exists, unit, aiState } = gameState.entities;

    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        if (aiState[i].state == AISTATE.NONE) {
            // don't do nothin'
            decel(i);
            resetUnitAnim(i, ANIM.IDLE);
            continue;
        }
        aiBehaviorToUpdateFn[unit[i].aiBehavior](i);
    }
}

function updatePhysicsState()
{
    const { exists, pos, vel, maxVel, accel, angle, physState, debugState } = gameState.entities;

    // move, collide
    for (let i = 0; i < exists.length; ++i) {
        if (!(exists[i] && pos[i] != null && physState[i] != null && vel[i] != null && accel[i] != null && maxVel[i] != null)) {
            continue;
        }
        physState[i].colliding = false;
        vecAddTo(vel[i], accel[i]);
        vecClampMag(vel[i], 0, maxVel[i]);
        if (vecAlmostZero(vel[i])) {
            vecClear(vel[i]);
        }
        if (debugState[i] != null) {
            debugState[i].velPreColl = vecClone(vel[i]);
        }
        vecAddTo(pos[i], vel[i]);
    };

    // very simple collisions, just correct position and change vel to slide along
    const pairs = [];
    updateAllCollidingPairs(pairs);
    for (let k = 0; k < pairs.length; ++k) {
        const [i, j] = pairs[k];
        physState[i].colliding = true;
        physState[j].colliding = true;
        const dir = vecSub(pos[j],pos[i]);
        const len = vecLen(dir);
        if ( almostZero(len) ) {
            dir = vec(1,0);
        } else {
            vecMulBy(dir, 1/len);
        }
        const veliLen = vecLen(vel[i])
        const veljLen = vecLen(vel[j])
        const velSum = veliLen + veljLen;
        let velif = 0.5;
        let veljf = 0.5;
        if (!almostZero(velSum)) {
            velif = veliLen / velSum;
            veljf = veljLen / velSum;
        }
        const radiusi = physState[i].collRadius;
        const radiusj = physState[j].collRadius;
        const correctionDist = (radiusi + radiusj - len);
        const correctioni = -correctionDist * velif;
        const correctionj = correctionDist * veljf;
        const corrj = vecMul(dir, correctionj);
        const corri = vecMul(dir, correctioni);

        vecAddTo(pos[i], corri);
        vecAddTo(pos[j], corrj);

        // fix the velocity; slide by removing component normal to collision
        // only if it's > 0, otherwise we'll go toward the collision!
        const veliNormLen = vecDot(vel[i], dir);
        if (veliNormLen > 0) {
            vecSubFrom(vel[i], vecMul(dir, veliNormLen));
        }
        // opposite side should be against dir, so works the same except we want it to be < 0
        const veljNormLen = vecDot(vel[j], dir);
        if (veljNormLen < 0) {
            vecSubFrom(vel[j], vecMul(dir, veljNormLen));
        }
    }

    // rotate to face vel
    for (let i = 0; i < exists.length; ++i) {
        if (!(exists[i] && vel[i] != null && angle[i] != null)) {
            continue;
        }
        if (vecLen(vel[i]) > params.minUnitVelocity) {
            angle[i] = vecToAngle(vel[i]);
        }
    };
}

function hitUnit(i, damage, armorPen=0)
{
    const { unit, hp, hitState, playerId } = gameState.entities;
    const armor = getUnitArmor(playerId[i], unit[i]);
    const effectiveArmor = Math.max(armor - armorPen, 0);
    hp[i] -= Math.max(damage - effectiveArmor, 0);
    hitState[i].hitTimer = params.hitFadeTimeMs;
    hitState[i].hpBarTimer = params.hpBarTimeMs;
}

function unitHitUnit(hitter, hittee)
{
    const { unit, playerId } = gameState.entities;
    const weapon = getUnitWeapon(unit[hitter]);
    const damage = getUnitDamage(playerId[hitter], unit[hitter]);
    hitUnit(hittee, damage, weapon.armorPen);
}

function isOnIsland(i)
{
    const { pos } = gameState.entities;
    for (const island of Object.values(gameState.islands)) {
        if (getDist(pos[i], island.pos) < params.islandRadius) {
            return true;
        }
    }
    return false;
}

function isOnEnemyIsland(i)
{
    const { pos, playerId, lane } = gameState.entities;
    if (getDist(pos[i], gameState.players[lane[i].otherPlayerIdx].island.pos) < params.islandRadius) {
        return true;
    }
    return false;
}

function isOnOwnIsland(i)
{
    const { pos, playerId } = gameState.entities;
    if (getDist(pos[i], gameState.players[playerId[i]].island.pos) < params.islandRadius) {
        return true;
    }
    return false;
}

function updateHitState(timeDeltaMs)
{
    const { freeable, unit, color, pos, vel, accel, hp, lane, laneIdx, team, playerId, aiState, atkState, hitState, physState } = gameState.entities;
    forAllUnits((i) => {
        hitState[i].hitTimer = Math.max(hitState[i].hitTimer - timeDeltaMs, 0);
        hitState[i].hpBarTimer = Math.max(hitState[i].hpBarTimer - timeDeltaMs, 0);

        switch (hitState[i].state) {
            case HITSTATE.SPAWN:
            {
                if (hitState[i].spawnTimer > 0) {
                    hitState[i].spawnTimer -= timeDeltaMs;
                } else {
                    hitState[i].state = HITSTATE.ALIVE;
                    aiState[i].state = unit[i].defaultAiState;
                }
                break;
            }
            case HITSTATE.ALIVE:
            {
                const onIsland = isOnIsland(i);
                // die from damage
                if (hp[i] <= 0) {
                    const enemyPlayer = getEnemyPlayerByTeam(team[i]);
                    // fade hpTimer fast
                    if (hitState[i].hpBarTimer > 0) {
                        hitState[i].hpBarTimer = params.deathTimeMs*0.5;
                    }
                    hitState[i].deadTimer = params.deathTimeMs;
                    hitState[i].state = HITSTATE.DEAD;
                    aiState[i].state = AISTATE.NONE;
                    // TODO pause animation/death animation
                    physState[i].canCollide = false;
                    vecClear(vel[i]);
                    vecClear(accel[i]);
                    enemyPlayer.soulsFromUnitsKilled++;
                    spawnUnitForPlayer(pos[i], enemyPlayer.id, units[UNIT.SOUL], laneIdx[i]);
                    playSfx('death');
                // die from falling
                } else if (!onIsland && physState[i].canFall && hitState[i].state == HITSTATE.ALIVE) {
                    const { baseIdx, point, dir, dist } = pointNearLineSegs(pos[i], gameState.bridges[laneIdx[i]].bridgePoints);
                    if (dist >= params.laneWidth*0.5) {
                        // TODO push it with a force, don't just teleport
                        vecAddTo(pos[i], vecMulBy(dir, unit[i].radius));
                        // fade hpTimer fast
                        if (hitState[i].hpBarTimer > 0) {
                            hitState[i].hpBarTimer = params.deathTimeMs*0.5;
                        }
                        hitState[i].fallTimer = params.fallTimeMs;
                        hitState[i].deadTimer = params.fallTimeMs; // same as fall time!
                        hitState[i].state = HITSTATE.DEAD;
                        aiState[i].state = AISTATE.NONE;
                        // TODO pause animation/death animation
                        physState[i].canCollide = false;
                        vecClear(vel[i]);
                        vecClear(accel[i]);
                    }
                // souls hit own lighthouse and give...souls
                } else if (unit[i].id == UNIT.SOUL) {
                    const player = gameState.players[playerId[i]];
                    const lighthouseIdx = player.island.idx;
                    if (onIsland && getDist(pos[i], pos[lighthouseIdx]) < params.lighthouseRadius) {
                        player.souls++;
                        player.soulsEarned++;
                        // playSfx('soulEarned'); // TODO?
                        // instantly disappear this frame
                        freeable[i] = true;
                    }
                // 'die' by scoring
                } else {
                    const enemyPlayer = getEnemyPlayerByTeam(team[i]);
                    const player = gameState.players[playerId[i]];
                    const enemyLighthouseIdx = enemyPlayer.island.idx;
                    if (onIsland && getDist(pos[i], pos[enemyLighthouseIdx]) < params.lighthouseRadius) {
                        hp[enemyLighthouseIdx] -= unit[i].damageToBase;
                        hitState[enemyLighthouseIdx].hitTimer = params.hitFadeTimeMs;
                        hitState[enemyLighthouseIdx].hpBarTimer = params.hpBarTimeMs;
                        player.soulsFromLighthouse++;
                        spawnUnitForPlayer(pos[i], player.id, units[UNIT.SOUL], laneIdx[i]);
                        playSfx('lighthouseHit');
                        if ( hp[enemyLighthouseIdx] <= 0 ) {
                            endCurrentGame(player);
                        }
                        // instantly disappear this frame
                        freeable[i] = true;
                    }
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

export function endCurrentGame(winningPlayer)
{
    deferUpdate(() => {
        const localPlayer = getLocalPlayer();
        // TODO this is a hack so the lighthouse HP shows as 0 when game ends
        UI.startFrame();
        updatePlayersActionsAndUI(0);
        App.gameOver(winningPlayer.name, winningPlayer.color);
        Music.stop();
                // any local human win == victory
        if (    winningPlayer.controller == PLAYER_CONTROLLER.LOCAL_HUMAN ||
                // both bots = victory
                (gameState.players.filter( ({controller}) => controller == PLAYER_CONTROLLER.BOT).length == 2)) {
            playSfx('victory');
        } else {
            playSfx('defeat');
        }
    });
}

function doWeaponHit(i)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    console.assert(atkState[i].state == ATKSTATE.RECOVER);
    const t = target[i].getIndex();
    console.assert(t != INVALID_ENTITY_INDEX);
    const weapon = getUnitWeapon(unit[i]);

    switch(unit[i].id) {
        case UNIT.TANK:
        {
            if (canAttackTarget(i) && atkState[i].didHit) {
                unitHitUnit(i, t);
                spawnVFXExplosion(pos[t], weapon.aoeRadius, 300);
            }
            break;
        }
        case UNIT.CHOGORINGU:
        {
            if (canAttackTarget(i) && atkState[i].didHit) {
                unitHitUnit(i, t);
            }
            break;
        }
        case UNIT.BIGEYE:
        {
            for (const j of getCollidingWithCircle(atkState[i].aoeHitPos, weapon.aoeRadius)) {
                if (team[i] != team[j]) {
                    unitHitUnit(i, j);
                }
            }
            spawnVFXExplosion(atkState[i].aoeHitPos, weapon.aoeRadius, 300);
            break;
        }
        case UNIT.TOWER:
        {
            if (canAttackTarget(i) && atkState[i].didHit) {
                unitHitUnit(i, t);
                spawnVFXExplosion(atkState[i].aoeHitPos, weapon.aoeRadius, 300);
            }
            break;
        }
    }
}

function startWeaponSwing(i)
{
    const { exists, team, playerId, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    console.assert(atkState[i].state == ATKSTATE.SWING);
    const t = target[i].getIndex();
    console.assert(t != INVALID_ENTITY_INDEX);
    const weapon = getUnitWeapon(unit[i]);

    switch(unit[i].id) {
        case UNIT.CHOGORINGU:
        {
            // can't miss twice
            atkState[i].didHit = canAttackTarget(i) && (!atkState[i].didHit || Math.random() > weapon.missChance);
            break;
        }
        case UNIT.TANK:
        {
            atkState[i].didHit = canAttackTarget(i) && (!atkState[i].didHit || Math.random() > weapon.missChance);
            break;
        }
        case UNIT.BIGEYE:
        {
            const targetPos = pos[t];
            // how far off target are we? 0 == completely on-target, 1 == completely off-target
            const offTarget = Math.random() * (1 - weapon.aoeAccuracy);
            const offVec = vecMulBy(vecMulBy(vecRandDir(), offTarget), weapon.aoeMissRadius);
            const hitPos = vecAdd(targetPos, offVec);
            atkState[i].aoeHitPos = hitPos;
            spawnVFXBigEyeBeam(i, vecClone(hitPos));
            break;
        }
        case UNIT.TOWER:
        {
            const player = gameState.players[playerId[i]];
            const hitPos = vecClone(pos[t]);
            atkState[i].didHit = canAttackTarget(i) && (!atkState[i].didHit || Math.random() > weapon.missChance);
            if (!atkState[i].didHit) {
                const offDist = unit[t].radius + weapon.aoeRadius + weapon.aoeMissRadius * Math.random();
                const offVec = vecMulBy(vecRandDir(), offDist);
                vecAddTo(hitPos, offVec);
            }
            atkState[i].aoeHitPos = hitPos;
            spawnVFXStaticDBeam(pos[i], hitPos, player.color);
            break;
        }
    }

    playSfx(weapon.sfxName);
}

function updateUnitAtkState(timeDeltaMs)
{
    forAllUnits((i) => {
        const unit = gameState.entities.unit[i];
        const aiState = gameState.entities.aiState[i];
        if (aiState.state != AISTATE.ATTACK) {
            return;
        }
        const atkState = gameState.entities.atkState[i];
        const animState = gameState.entities.animState[i];
        const attackAnim = getUnitAnim(unit, ANIM.ATK);

        switch (atkState.state) {
            case ATKSTATE.AIM:
            {
                if (animState.timer >= unit.swingTime) {
                    atkState.state = ATKSTATE.SWING;
                    startWeaponSwing(i);
                }
                break;
            }
            case ATKSTATE.SWING:
            {
                if (animState.timer >= unit.hitTime) {
                    atkState.state = ATKSTATE.RECOVER;
                    doWeaponHit(i);
                }
                break;
            }
            case ATKSTATE.RECOVER:
            {
                if (animState.timer == 0) { // its been reset
                    atkState.state = ATKSTATE.AIM;
                }
                break;
            }
        }
    });
}

function resetUnitAnim(i, animName, loop = true)
{
    const animState = gameState.entities.animState[i];
    animState.anim = animName;
    animState.frame = 0;
    animState.timer = 0;
    animState.loop = loop;
}

function playUnitAnim(i, animName, reset = false, loop = true)
{
    const animState = gameState.entities.animState[i];
    if (reset || animState.anim != animName) {
        resetUnitAnim(i, animName, loop);
    // prob don't need this
    } else if (loop != animState.loop) {
        animState.loop = true;
    }
}

function updateUnitAnimState(timeDeltaMs)
{
    forAllUnits((i) => {
        const unit = gameState.entities.unit[i];
        const aState = gameState.entities.animState[i];
        const anim = getUnitAnim(unit, aState.anim);
        // frameDur is not used currently
        const durationMs = unit.atkMs;//anim.frames * anim.frameDur;
        aState.timer += timeDeltaMs;
        // current frame determined by timer only
        aState.frame = Math.floor(clamp(aState.timer / durationMs, 0, 0.9999) * anim.frames);
        if (aState.timer >= durationMs) {
            if (aState.loop) {
                aState.frame = 0;
                aState.timer = 0;
            }
        }
    });
}

function updateTraceParticles(particles)
{
    const numParticles = particles.length
    for (let p = 0; p < numParticles; ++p) {
        const particle = particles[p];
        vecAddTo(particle.vel, particle.accel);
        vecAddTo(particle.pos, particle.vel);
    }
}

function updateVFXState(timeDeltaMs)
{
    const { exists, freeable, vfxState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.VFX)) {
            continue;
        }
        const vfx = vfxState[i];
        vfx.timeMs -= timeDeltaMs;
        if (vfx.timeMs <= 0) {
            freeable[i] = true;
            continue;
        }
        if (vfx.traceParticles) {
            updateTraceParticles(vfx.traceParticles);
        }
    }
}

function updateSoulState(timeDeltaMs)
{
    const { exists, freeable, pos, vel, accel, maxAccel, soulState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.SOUL)) {
            continue;
        }
        const soul = soulState[i];
        const targetPos = soul.doneStaging ? soul.targetPos : soul.stagingPos;
        const toTarget = vecSub(targetPos, pos[i]);
        const dist = vecLen(toTarget);
        if (dist < params.soulCollectionRadius) {
            if (soul.doneStaging) {
                freeable[i] = true;
            } else {
                soul.doneStaging = true;
            }
            break;
        }
        const newAccel = remap(params.soulMinAccelRadius, params.soulMaxAccelRadius, params.soulMinAccel, params.soulMaxAccel, dist, true);
        const dir = vecMul(toTarget, 1/dist);
        accel[i] = vecMul(dir, newAccel);
    }
}

function updateDreamerState(timeDeltaMs)
{
    const { playerId, unit, homeIsland, pos, lane, color } = gameState.entities;
    const timeDeltaSec = 0.001 * timeDeltaMs;
    for (const bridge of gameState.bridges) {
        const { dreamer, middlePos } = bridge;
        const bridgePoints = bridge.bridgePoints;
        const dIdx = dreamer.idx;
        const playerIds = Object.keys(bridge.playerLanes);
        console.assert(playerIds.length == 2);
        const playerCounts = {};
        for (const pId of playerIds) {
            playerCounts[pId] = 0;
        }
        let minX = pos[dIdx].x;
        let minUnitIdx = dIdx;
        let maxX = pos[dIdx].x;
        let maxUnitIdx = dIdx;

        forAllUnits(i => {
            if (playerId[i] == NO_PLAYER_INDEX || !homeIsland[i] || !unit[i].canDream) {
                return;
            }
            if (lane[i] != bridge.playerLanes[playerId[i]]) {
                return;
            }
            const toDreamer = vecSub(pos[dIdx], pos[i]);
            const toHome = vecSub(homeIsland[i].pos, pos[i]);
            if (vecDot(toDreamer, toHome) > 0) {
                playerCounts[playerId[i]]++;
                if (pos[i].x < minX) {
                    minX = pos[i].x;
                    minUnitIdx = i;
                } else if (pos[i].x > maxX) {
                    maxX = pos[i].x;
                    maxUnitIdx = i;
                }
            }
        });
        let attackingPlayer = NO_PLAYER_INDEX;
        dreamer.targetPos = vecClone(middlePos); // by default go back to the middle
        if (playerCounts[playerIds[0]] > playerCounts[playerIds[1]]) {
            attackingPlayer = playerIds[0];
            const rightX = bridgePoints[bridgePoints.length - 1].x;
            dreamer.targetPos.x = Math.min(maxX - params.dreamerTetherDist, rightX);
            dreamer.targetPos.y = pos[maxUnitIdx].y;
        } else if (playerCounts[playerIds[0]] < playerCounts[playerIds[1]]) {
            attackingPlayer = playerIds[1];
            const leftX = bridgePoints[0].x;
            dreamer.targetPos.x = Math.max(minX + params.dreamerTetherDist, leftX);
            dreamer.targetPos.y = pos[minUnitIdx].y;
        }
        const oldAttackingPlayer = playerId[dIdx];
        playerId[dIdx] = attackingPlayer;
        if (attackingPlayer != NO_PLAYER_INDEX) {
            const player = gameState.players[attackingPlayer];
            color[dIdx] = player.color;
            if (oldAttackingPlayer != attackingPlayer) {
                dreamer.goldEarned = 0;
                dreamer.timer = 1000;
            } else {
                dreamer.timer -= timeDeltaMs;
                if (dreamer.timer <= 0) {
                    dreamer.goldEarned += params.dreamerGoldPerSec;
                    dreamer.timer = 1000;
                    // TODO compute dreamer head pos properly for spawning screams
                    const randX = -4 + (Math.random() - 0.5) * 16;
                    spawnVFXScream(vecAdd(pos[dIdx], vec(randX, -params.dreamerLaneDist-24)));
                }
            }
            // snap targetPos to lane center
            const { point } = Utils.pointNearLineSegs(dreamer.targetPos, bridgePoints);
            dreamer.targetPos = point;
        } else {
            color[dIdx] = params.neutralColor;
        }
    }
}

function updatePlayerState(timeDeltaMs)
{
    const timeDeltaSec = 0.001 * timeDeltaMs;
    const ecoUpgrade = upgrades[UPGRADE.ECO];

    // set base gold rate
    for (const player of gameState.players) {
        player.goldPerSec = params.startingGoldPerSec;
        // track base gold
        player.goldBaseEarned += params.startingGoldPerSec * timeDeltaSec;
    }
    // add dreamer gold
    for (const { dreamer } of gameState.bridges) {
        if (dreamer.playerId == NO_PLAYER_INDEX) {
            continue;
        }
        const player = gameState.players[dreamer.playerId];
        player.goldPerSec += params.dreamerGoldPerSec;
        // track dreamer gold
        player.goldFromDreamers += params.dreamerGoldPerSec * timeDeltaSec;
    }
    for (const player of gameState.players) {
        // add eco gold
        const upgradeLevel = player.upgradeLevels[UPGRADE.ECO];
        const ecoGoldPerSec = upgradeLevel < 0 ? 0 : ecoUpgrade.goldPerSecBonus[upgradeLevel];
        player.goldPerSec += ecoGoldPerSec;
        // update gold and tracking
        const goldTotalThisFrame = player.goldPerSec * timeDeltaSec;
        player.gold += goldTotalThisFrame;
        player.goldEarned += goldTotalThisFrame;
        // just eco
        player.goldFromEcoUpgrades += ecoGoldPerSec * timeDeltaSec;

        // cooldowns
        for (const unitId of Object.values(UNIT)) {
            const newVal = player.unitCds[unitId] - timeDeltaMs;
            player.unitCds[unitId] = Math.max(newVal, 0);
        }
    }
}

function updateGame(timeDeltaMs)
{
    const { exists, freeable } = gameState.entities;

    // order here matters!
    updatePhysicsState();
    // units
    updateUnitAiState();
    updateUnitAnimState(timeDeltaMs);
    updateUnitAtkState(timeDeltaMs);
    // souls
    updateSoulState(timeDeltaMs);
    // VFX
    updateVFXState(timeDeltaMs);

    // this should come right before reap
    updateHitState(timeDeltaMs);
    reapFreeableEntities();

    updateDreamerState(timeDeltaMs); // should come before player state, since dreamer affects income
    updatePlayerState(timeDeltaMs);
}

function playSfx(name)
{
    if (App.state.sfxEnabled) {
        const asset = assets.sfx[name];
        const audio = asset.sound.cloneNode();
        audio.volume = asset.volume;
        audio.play();
    }
}

export function canBuildUnit(playerId, unit, spawnPos = null)
{
    const player = gameState.players[playerId];
    if (!player.unitUnlocked[unit.id]) {
        return false;
    }
    if (player.laneSelected < 0) {
        return false;
    }
    if (player.gold < unit.cost) {
        return false;
    }
    if (player.unitCds[unit.id] > 0) {
        return false;
    }
    if (spawnPos != null && getCollidingWithCircle(spawnPos, unit.radius).length > 0) {
        return false;
    }
    return true;
}

export function tryBuildUnit(playerId, unit, laneIdx=null, desiredPos=null)
{
    if (!canBuildUnit(playerId, unit, desiredPos)) {
        return false;
    }
    const player = gameState.players[playerId];
    let idx = INVALID_ENTITY_INDEX;
    if (laneIdx == null) {
        laneIdx = player.laneSelected;
        if (laneIdx == -1) {
            return false;
        }
    }
    if (desiredPos == null) {
        let iters = 100;
        while (idx == INVALID_ENTITY_INDEX && iters > 0) {
            idx = spawnUnitInLane(laneIdx, playerId, unit);
            iters--;
        }
    } else {
        const spawnPos = gameState.players[playerId].island.lanes[laneIdx].spawnPos;
        const dist = vecLen(vecSub(desiredPos, spawnPos));
        if (dist > params.spawnPlatRadius) {
            return false;
        }
        idx = spawnUnitForPlayer(desiredPos, playerId, unit, laneIdx);
    }
    if (idx == INVALID_ENTITY_INDEX) {
        return false;
    }
    playSfx('spawn');
    player.gold -= unit.cost;
    player.unitCds[unit.id] = 0; // TODO remove properly
    return true;
}

export function canUnlockUnit(playerId, unit)
{
    const player = gameState.players[playerId];
    if (player.unitUnlocked[unit.id]) {
        return false;
    }
    if (player.souls < unit.unlockCost) {
        return false;
    }
    return true;
}

export function tryUnlockUnit(playerId, unit)
{
    if (!canUnlockUnit(playerId, unit)) {
        return false;
    }
    const player = gameState.players[playerId];
    player.souls -= unit.unlockCost;
    player.unitUnlocked[unit.id] = true;
    player.unitCds[unit.id] = 0; // TODO remove properly
    playSfx('unlockUnit');
    return true;
}

export function canUpgrade(playerId, upgradeId)
{
    const player = gameState.players[playerId];
    const upgrade = upgrades[upgradeId];
    const currLevel = player.upgradeLevels[upgradeId];
    const maxLevel = upgrade.soulsCost.length - 1;
    if (currLevel >= maxLevel) {
        return false;
    }
    const cost = upgrade.soulsCost[currLevel + 1];
    if (player.souls < cost) {
        return false;
    }
    return true;
}

export function tryUpgrade(playerId, upgradeId)
{
    if (!canUpgrade(playerId, upgradeId)) {
        return false;
    }
    const player = gameState.players[playerId];
    player.upgradeLevels[upgradeId]++;
    const newLevel = player.upgradeLevels[upgradeId];
    const upgrade = upgrades[upgradeId];
    const cost = upgrade.soulsCost[newLevel];
    player.souls -= cost;
    playSfx(upgrade.sfxName);
    if (upgradeId == UPGRADE.TOWER) {
        const { pos } = gameState.entities;
        const unit = units[UNIT.TOWER];
        const lightPos = vecAdd(pos[player.island.idx], vec(0,-148));
        spawnUnitForPlayer(lightPos, playerId, unit);
    }
    return true;
}

function selectRandomLane(player)
{
    player.laneSelected = Math.floor(Math.random()*player.island.lanes.length);
}

function botGetRandomSoulAction(player, timeDeltaMs)
{
    const botActions = [];
    Object.values(Data.hotKeys[player.id].units)
        .forEach(unitId => {
            const unit = units[unitId];
            const unlocked = player.unitUnlocked[unit.id];
            if (!unlocked) {
                const canDo = () => canUnlockUnit(player.id, unit);
                const action = () => tryUnlockUnit(player.id, unit);
                botActions.push({ canDo, action });
            }
        });
    Object.values(Data.hotKeys[player.id].upgrades)
        .forEach(upgradeId => {
            const upgrade = upgrades[upgradeId];
            const currLevel = player.upgradeLevels[upgradeId];
            const maxLevel = upgrade.soulsCost.length - 1;
            if (currLevel < maxLevel) {
                const canDo = () => canUpgrade(player.id, upgradeId);
                const action = () => tryUpgrade(player.id, upgradeId);
                botActions.push({ canDo, action });
            }
        });

    if (botActions.length > 0) {
        return randFromArray(botActions);
    }

    console.log("can't do any soul action");

    return { canDo: () => true, action: () => true };
}

function botGetRandomGoldAction(player, timeDeltaMs)
{
    const botActions = [];
    Object.values(Data.hotKeys[player.id].units)
        .forEach(unitId => {
            const unit = units[unitId];
            const unlocked = player.unitUnlocked[unit.id];
            if (unlocked) {
                const canDo = () => canBuildUnit(player.id, unit);
                const action = () => {
                    selectRandomLane(player);
                    return tryBuildUnit(player.id, unit);
                };
                botActions.push({ canDo, action });
            }
        });

    if (botActions.length > 0) {
        return randFromArray(botActions);
    }

    console.log("can't do any gold action");

    return { canDo: () => true, action: () => true };
}

function botAggroActions(actionList, timeDeltaMs)
{
//TODO fix
    player.laneSelected = Math.floor(Math.random()*player.island.lanes.length);
    const botActions = [
        ()=>{ return true; } // do nothing action, keep it somewhat easy
    ];
    const unit = units[UNIT.CHOGORINGU];
    if (canBuildUnit(player.id, unit)) {
        botActions.push(() => {
            selectRandomLane(player);
            return tryBuildUnit(player.id, unit);
        });
    }
    if (botActions.length > 0) {
        return randFromArray(botActions);
    }
    return null;
}

const botStrategyToFunc = {
    [BOT.RANDOM]: {
        getGoldAction: botGetRandomGoldAction,
        getSoulAction: botGetRandomSoulAction,
    },
    // TODO aggro
};

function updateBotPlayer(player, timeDeltaMs)
{
    player.botState.actionTimer -= timeDeltaMs;
    if (player.botState.actionTimer > 0) {
        return;
    }
    const goldActions = player.botState.goldActions;
    const soulActions = player.botState.soulActions;
    const { getGoldAction, getSoulAction } = botStrategyToFunc[player.botState.strategy];
    if (goldActions.length == 0) {
        goldActions.push(getGoldAction(player, timeDeltaMs));
    }
    {
        const { canDo, action } = goldActions[0];
        if (canDo()) {
            goldActions.shift();
            if (!action()) {
                console.error("bot failed gold action");
            }
        }
    }
    if (soulActions.length == 0) {
        soulActions.push(getSoulAction(player, timeDeltaMs));
    }
    {
        const { canDo, action } = soulActions[0];
        if (canDo()) {
            soulActions.shift();
            if (!action()) {
                console.error("bot failed soul action");
            }
        }
    }

    player.botState.actionTimer += 2000;
}

function updatePlayersActionsAndUI(timeDeltaMs)
{
    UI.processMouseInput();
    for (const player of gameState.players) {
        // draw UI for player and bot
        UI.doPlayerUI(player);
        // don't let bot play while paused
        if (!debug.paused && player.controller == PLAYER_CONTROLLER.BOT) {
            updateBotPlayer(player, timeDeltaMs);
        }
    }
}

const deferred = [];
function doDeferredUpdates()
{
    for (const fn of deferred) {
        fn();
    }
    deferred.length = 0;
}
// do something at the end of the current update function
function deferUpdate(fn)
{
    deferred.push(fn);
}

export function update(realTimeMs, __ticksMs /* <- don't use this unless we fix debug pause */, timeDeltaMs)
{
    if (App.state.screen != SCREEN.GAME) {
        return;
    }

    if (keyPressed('Escape')) {
        App.pause();
    } else {
        UI.startFrame();
        UI.debugUI(timeDeltaMs);
        // keep doing player actions while debug paused
        updatePlayersActionsAndUI(timeDeltaMs);
        if (!debug.enableControls || !debug.paused || debug.frameAdvance) {
            updateGame(timeDeltaMs);
        }
        debug.frameAdvance = false;
    }
    updateGameInput();
    doDeferredUpdates();
}
