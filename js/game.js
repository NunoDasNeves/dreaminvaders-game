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
    // ignore bases
    if (unit[theirIdx].id == UNIT.BASE) {
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

function decel(i)
{
    const { vel, accel, maxAccel } = gameState.entities;
    // friction: decelerate automatically if velocity with no acceleration
    const velLen = vecLen(vel[i]);
    // accel to inverse of velLen; ensures we don't undershoot and go backwards
    vecClear(accel[i])
    vecCopyTo(accel[i], vel[i]);
    vecNegate(accel[i]);
    // common case; reduce vel by acceleration rate
    if (maxAccel[i] < velLen) {
        vecSetMag(accel[i], maxAccel[i]);
    }
}

function accelUnitAwayFromEdge(i)
{
    const { unit, lane, team, pos, accel, maxAccel } = gameState.entities;
    const bridgePoints = lane[i].bridgePoints;
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

function updateUnitAiState()
{
    const { exists, playerId, unit, pos, vel, accel, maxAccel, angle, angVel, lane, target, aiState, atkState, debugState } = gameState.entities;

    for (let i = 0; i < exists.length; ++i) {
        if (!entityExists(i, ENTITY.UNIT)) {
            continue;
        }
        if (aiState[i].state == AISTATE.DO_NOTHING) {
            continue;
        }
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
                const mostlyStopped = vecLen(vel[i]) < (unit[i].maxSpeed * 0.5);
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
        // make decisions based on state
        switch (aiState[i].state) {
            case AISTATE.IDLE: {
                decel(i);
                playUnitAnim(i, ANIM.IDLE);
                break;
            }
            case AISTATE.PROCEED:
            {
                // TODO assumes lane[i] is not null
                const bridgePoints = lane[i].bridgePoints;
                const { baseIdx, point, dir, dist } = pointNearLineSegs(pos[i], bridgePoints);
                let currIdx = baseIdx;
                let nextIdx = baseIdx+1;
                // if close to next point, go there instead
                if (getDist(pos[i], bridgePoints[baseIdx+1]) < params.laneWidth*0.5) {
                    currIdx++;
                    nextIdx++;
                }
                const currPoint = bridgePoints[currIdx];
                const nextPoint = vec();
                // little bit of a hack, just check if we're on the island to go straight to the base
                let goToPoint = false
                if (nextIdx >= bridgePoints.length || getDist(pos[i], enemyIsland.pos) < params.islandRadius) {
                    goToPoint = true;
                    vecCopyTo(nextPoint, enemyLighthousePos);
                } else {
                    vecCopyTo(nextPoint, bridgePoints[nextIdx]);
                }
                let goDir = null
                if (goToPoint) {
                    // go to the point
                    goDir = vecNormalize(vecSub(nextPoint, pos[i]))
                } else {
                    // go parallel to the bridge line
                    goDir = vecNormalize(vecSub(nextPoint, currPoint));
                }
                accel[i] = vecMul(goDir, maxAccel[i]);
                if (!isOnEnemyIsland(i)) {
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
    const damage = getWeaponDamage(playerId[hitter], weapon);
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
    const { freeable, unit, color, pos, vel, accel, hp, lane, team, playerId, aiState, atkState, hitState, physState } = gameState.entities;
    forAllUnits((i) => {
        hitState[i].hitTimer = Math.max(hitState[i].hitTimer - timeDeltaMs, 0);
        hitState[i].hpBarTimer = Math.max(hitState[i].hpBarTimer - timeDeltaMs, 0);

        switch (hitState[i].state) {
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
                    aiState[i].state = AISTATE.DO_NOTHING;
                    physState[i].canCollide = false;
                    vecClear(vel[i]);
                    vecClear(accel[i]);
                    const souls = 1;
                    enemyPlayer.souls += souls;
                    enemyPlayer.soulsFromUnitsKilled += souls;
                    enemyPlayer.soulsEarned += souls;
                    spawnSoul(pos[i], enemyPlayer);
                    playSfx('death');
                // die from falling
                } else if (!onIsland && physState[i].canFall && hitState[i].state == HITSTATE.ALIVE) {
                    const { baseIdx, point, dir, dist } = pointNearLineSegs(pos[i], lane[i].bridgePoints);
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
                        aiState[i].state = AISTATE.DO_NOTHING;
                        physState[i].canCollide = false;
                        vecClear(vel[i]);
                        vecClear(accel[i]);
                    }
                // 'die' by scoring
                } else {
                    const enemyPlayer = getEnemyPlayerByTeam(team[i]);
                    const player = gameState.players[playerId[i]];
                    const enemyLighthouseIdx = enemyPlayer.island.idx;
                    if (onIsland && getDist(pos[i], pos[enemyLighthouseIdx]) < params.lighthouseRadius) {
                        hp[enemyLighthouseIdx] -= unit[i].lighthouseDamage;
                        hitState[enemyLighthouseIdx].hitTimer = params.hitFadeTimeMs;
                        hitState[enemyLighthouseIdx].hpBarTimer = params.hpBarTimeMs;
                        const souls = 1;
                        player.souls += souls; // TODO defer until soul hits base
                        player.soulsFromLighthouse += souls;
                        player.soulsEarned += souls;
                        spawnSoul(pos[i], player);
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

    switch(weapon.id) {
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

    switch(weapon.id) {
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
                if (animState.timer >= attackAnim.swingTime) {
                    atkState.state = ATKSTATE.SWING;
                    startWeaponSwing(i);
                }
                break;
            }
            case ATKSTATE.SWING:
            {
                if (animState.timer >= attackAnim.hitTime) {
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
        const duration = anim.frames * anim.frameDur;
        aState.timer += timeDeltaMs;
        aState.frame = Math.floor(clamp(aState.timer / duration, 0, 0.9999) * anim.frames);
        if (aState.timer >= duration) {
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
    const { playerId, unit, homeIsland, pos, lane } = gameState.entities;
    const timeDeltaSec = 0.001 * timeDeltaMs;
    for (const bridge of gameState.bridges) {
        const { dreamer, middlePos } = bridge;
        const playerIds = Object.keys(bridge.playerLanes);
        console.assert(playerIds.length == 2);
        const playerCounts = {};
        for (const pId of playerIds) {
            playerCounts[pId] = 0;
        }
        forAllUnits(i => {
            if (playerId[i] == NO_PLAYER_INDEX || !homeIsland[i]) {
                return;
            }
            if (lane[i] != bridge.playerLanes[playerId[i]]) {
                return;
            }
            const toMiddle = vecSub(middlePos, pos[i]);
            const toHome = vecSub(homeIsland[i].pos, pos[i]);
            if (vecDot(toMiddle, toHome) > 0) {
                playerCounts[playerId[i]]++;
            }
        });
        let attackingPlayer = NO_PLAYER_INDEX;
        if (playerCounts[playerIds[0]] > playerCounts[playerIds[1]]) {
            attackingPlayer = playerIds[0];
        } else if (playerCounts[playerIds[0]] < playerCounts[playerIds[1]]) {
            attackingPlayer = playerIds[1];
        }
        const oldAttackingPlayer = dreamer.playerId;
        dreamer.playerId = attackingPlayer;
        if (attackingPlayer != NO_PLAYER_INDEX) {
            const player = gameState.players[attackingPlayer];
            dreamer.color = player.color;
            if (oldAttackingPlayer != attackingPlayer) {
                dreamer.goldEarned = 0;
                dreamer.timer = 1000;
            } else {
                dreamer.timer -= timeDeltaMs;
                if (dreamer.timer <= 0) {
                    dreamer.goldEarned += params.dreamerGoldPerSec;
                    dreamer.timer = 1000;
                }
            }
        } else {
            dreamer.color = params.neutralColor;
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

export function canBuildUnit(playerId, unit)
{
    const player = gameState.players[playerId];
    if (!player.unitUnlocked[unit.id]) {
        return false;
    }
    if (player.laneSelected < 0) {
        return false;
    }
    if (player.gold < unit.goldCost) {
        return false;
    }
    if (player.unitCds[unit.id] > 0) {
        return false;
    }
    return true;
}

export function tryBuildUnit(playerId, unit, laneIdx=null, desiredPos=null)
{
    if (!canBuildUnit(playerId, unit)) {
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
    player.gold -= unit.goldCost;
    player.unitCds[unit.id] = unit.cdTimeMs;
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
    player.unitCds[unit.id] = unit.cdTimeMs;
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

function botRandomAction(player, timeDeltaMs)
{
    const botActions = [()=>{ return true; }]; // do nothing actions, keep it somewhat easy
    Object.values(Data.hotKeys[player.id].units)
        .forEach(unitId => {
            const unit = units[unitId];
            if (canUnlockUnit(player.id, unit)) {
                botActions.push(() => {
                    selectRandomLane(player);
                    return tryUnlockUnit(player.id, unit)
                });
            } else if (canBuildUnit(player.id, unit)) {
                botActions.push(() => {
                    selectRandomLane(player);
                    return tryBuildUnit(player.id, unit)
                });
            }
        });
    Object.values(Data.hotKeys[player.id].upgrades)
        .forEach(upgradeId => {
            if (canUpgrade(player.id, upgradeId)) {
                botActions.push(() => {
                    selectRandomLane(player);
                    return tryUpgrade(player.id, upgradeId)
                });
            }
        });
    if (botActions.length > 0) {
        return randFromArray(botActions);
    }
    return null;
}

function botAggroAction(player, timeDeltaMs)
{
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

function updateBotPlayer(player, timeDeltaMs)
{
    player.botState.actionTimer -= timeDeltaMs;
    if (player.botState.actionTimer > 0) {
        return;
    }
    let botAction = null;
    switch (player.botState.strategy) {
        case BOT.RANDOM:
            botAction = botRandomAction(player, timeDeltaMs);
            player.botState.actionTimer += 2000;
            break;
        case BOT.AGGRO:
            botAction = botAggroAction(player, timeDeltaMs);
            player.botState.actionTimer += 1000;
            break;
        /*case BOT.ECO:
            botEcoAction(player, timeDeltaMs);
            break;
        case BOT.TECH:
            botTechAction(player, timeDeltaMs);
            break;*/
    }
    if (botAction != null) {
        if (!botAction()) {
            console.error("bot failed action");
        }
    } else {
        console.log("bot no action");
    }
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
