import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

const backgroundColor = "#1f1f1f";
const basefadeColor = "#101010";
const laneColor = "#888888";
const laneWidth = 60;
const baseRadius = 200;
const baseVisualRadius = 250;
const laneDistFromBase = baseRadius - 5;
const teamColors = [ "#6f6f6f", "#ff9933", "#3399ff" ];
const TEAM = Object.freeze({
    NONE: 0,
    ORANGE: 1,
    BLUE: 2,
});
const STATE = Object.freeze({
    DO_NOTHING: 0,
    PROCEED: 1,
    CHASE: 2,
    ATTACK: 3,
});
const ATKSTATE = Object.freeze({
    NONE: 0,
    AIM: 1,
    SWING: 2,
    RECOVER: 3,
});

const debug = {
    drawRadii: true,
    drawSight: true,
}

let gameState = null;

const weapons = {
    none: {
        range: 0,
        aimMs: Infinity,
        cooldownMs: Infinity,
        damage: 0,
        missChance: 1,
        drawFn() {}
    },
    elbow: {
        range: 5,        // range starts at edge of unit radius, so the weapon 'radius' is unit.radius + weapon.range
        aimMs: 300,      // time from deciding to attack until starting attack
        swingMs: 200,    // time from starting attack til attack hits
        recoverMs: 400,  // time after attack hits til can attack again
        damage: 1,
        missChance: 0.3,
        drawFn(pos, angle, team, atkState) {
            const dir = vecFromAngle(angle);
            fillCircle(vecAdd(pos, vecMul(dir, 10)), 4, 'black');
        }
    }
};

const units = {
    base: {
        weapon: weapons.none,
        speed: 0,
        angSpeed: 0,
        maxHp: 1000,
        sightRadius: 0,
        radius: baseRadius,
        drawFn(pos, angle, team) {
            strokeCircle(pos, baseRadius, 2, 'red');
        }
    },
    circle: {
        weapon: weapons.elbow,
        speed: 3,
        angSpeed: 1,
        maxHp: 3,
        sightRadius: laneWidth/2,
        radius: 10,
        drawFn(pos, angle, team) {
            fillCircle(pos, 10, teamColors[team]);
        }
    },
};

function enemyTeam(team)
{
    return (team % 2) + 1;
}

function closestPoint(arr, pos)
{
    let minDist = Infinity;
    let minPoint = arr[0];
    for (let i = 0; i < arr.length; ++i) {
        const dist = vecLen(vecSub(arr[i], pos));
        if (dist < minDist) {
            minDist = dist;
            minPoint = arr[i]
        }
    }
    return minPoint;
}

function laneStart(lane, team)
{
    const base = gameState.bases[team];
    return vecClone(closestPoint(lane.points, base.pos));
}

function laneEnd(lane, team)
{
    const base = gameState.bases[enemyTeam(team)];
    return vecClone(closestPoint(lane.points, base.pos));
}

function spawnEntity(aPos, aTeam, aUnit, aLane = null)
{
    const { exists, nextFree, team, unit, hp, pos, vel, angle, angVel, state, lane, atkState  } = gameState.entities;
    const len = exists.length;
    if (gameState.freeSlot == -1) {
        for (const [key, arr] of Object.entries(gameState.entities)) {
            arr.push(null);
        }
        nextFree[len] = -1;
        gameState.freeSlot = len;
    }
    let idx = gameState.freeSlot;
    gameState.freeSlot = nextFree[idx];

    exists[idx]     = true;
    nextFree[idx]   = -1;
    team[idx]       = aTeam;
    lane[idx]       = aLane;
    unit[idx]       = aUnit;
    hp[idx]         = aUnit.maxHp;
    pos[idx]        = vecClone(aPos);
    vel[idx]        = vec();
    angle[idx]      = 0;
    angVel[idx]     = 0;
    state[idx]      = STATE.PROCEED;
    atkState[idx]   = { timer: 0, state: ATKSTATE.NONE };

    return idx;
}

function spawnEntityInLane(aLane, aTeam, aUnit)
{
    const pos = laneStart(aLane, aTeam);
    const randVec = vecMulBy(vec(Math.random(), Math.random()), laneWidth/2);
    vecAddTo(pos, randVec);
    return spawnEntity(pos, aTeam, aUnit, aLane);
}

function makeInput(oldInput = null)
{
    const input = {
            mousePos: vec(),
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false,
            keyQ: false,
            keyW: false
        };
    if (oldInput != null) {
        for (const [key, val] of Object.entries(oldInput)) {
            input[key] = val;
        }
        //overwrite vec with a copy...
        input.mousePos = vecClone(oldInput.mousePos);
    }
    return input;
}

export function initGame()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");

    gameState = {
        entities: {
            exists: [],
            nextFree: [],
            team: [],
            unit: [],
            hp: [],
            pos: [],
            vel: [],
            angle: [],
            angVel: [],
            state: [],
            target: [],
            atkState: [],
            lane: [],
        },
        freeSlot: -1,
        bases: {
            [TEAM.ORANGE]: { pos: { x: -600, y: -400 }, unit: -1 },
            [TEAM.BLUE]: { pos: { x: 600, y: 400 }, unit: -1 },
        },
        lanes: [],
        camera: {
            x: 0,
            y: 0,
            scale: 1, // scale +++ means zoom out
            easeFactor: 0.1
        },
        input: makeInput(),
        lastInput: makeInput(),
    };
    const orangeToBlue = vecNorm(vecSub(gameState.bases[TEAM.BLUE].pos, gameState.bases[TEAM.ORANGE].pos));
    gameState.lanes.push({
        points: [
            vecAdd(gameState.bases[TEAM.ORANGE].pos, vecMul(orangeToBlue, laneDistFromBase)),
            vecAdd(gameState.bases[TEAM.BLUE].pos, vecMul(orangeToBlue, -laneDistFromBase)),
        ]
    });

    gameState.bases[TEAM.BLUE].unit = spawnEntity(gameState.bases[TEAM.BLUE].pos, TEAM.BLUE, units.base, weapons.none);
    gameState.entities.state[gameState.bases[TEAM.BLUE].unit] = STATE.DO_NOTHING;
    gameState.bases[TEAM.ORANGE].unit = spawnEntity(gameState.bases[TEAM.ORANGE].pos, TEAM.ORANGE, units.base, weapons.none);
    gameState.entities.state[gameState.bases[TEAM.ORANGE].unit] = STATE.DO_NOTHING;

    spawnEntityInLane(gameState.lanes[0], TEAM.ORANGE, units.circle);
    spawnEntityInLane(gameState.lanes[0], TEAM.BLUE, units.circle);
}

// Convert camera coordinates to world coordinates with scale
export function cameraToWorld(x, y) {
    return {x: (x - canvas.width / 2) * gameState.camera.scale + gameState.camera.x,
            y: (y - canvas.height / 2) * gameState.camera.scale + gameState.camera.y};
}

// Convert world coordinates to camera coordinates with scale
export function worldToCamera(x, y) {
    return {x: (x - gameState.camera.x) / gameState.camera.scale + canvas.width / 2,
            y: (y - gameState.camera.y) / gameState.camera.scale + canvas.height / 2};
}

export function updateKey(key, pressed)
{
    if (key == 'q') {
        gameState.input.keyQ = pressed;
    }
    if (key == 'w') {
        gameState.input.keyW = pressed;
    }
}

export function updateMousePos(event)
{
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    gameState.input.mousePos = cameraToWorld(x, y);
}

export function updateMouseClick(button)
{
    switch (button) {
        case 0:
            gameState.input.mouseLeft = true;
            break;
        case 1:
            gameState.input.mouseMiddle = true;
            break;
        case 2:
            gameState.input.mouseRight = true;
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
    const teamColor = teamColors[team];
    const coords = worldToCamera(base.pos.x, base.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, baseRadius - 50, coords.x, coords.y, baseVisualRadius);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, basefadeColor);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, baseVisualRadius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fill();
}

function drawLane(lane)
{
    context.beginPath();
    let coords = worldToCamera(lane.points[0].x, lane.points[0].y);
    context.moveTo(coords.x, coords.y);

    for (let i = 1; i < lane.points.length; ++i) {
        coords = worldToCamera(lane.points[i].x, lane.points[i].y);
        context.lineTo(coords.x, coords.y);
        context.strokeStyle = laneColor;
        // Clear line dash
        context.setLineDash([]);
        context.lineWidth = laneWidth / gameState.camera.scale;
        context.stroke();
    }
}

export function render()
{
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const [team, base] of Object.entries(gameState.bases)) {
        drawBase(team, base);
    }

    for (let i = 0; i < gameState.lanes.length; ++i) {
        drawLane(gameState.lanes[i]);
    }

    const { exists, team, unit, pos, angle, state, target } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        unit[i].drawFn(pos[i], angle[i], team[i])
        if (debug.drawRadii) {
            strokeCircle(pos[i], unit[i].radius, 2, 'red');
        }
        if (debug.drawSight && unit[i].sightRadius > 0)
        {
            strokeCircle(pos[i], unit[i].sightRadius, 1, 'yellow');
        }
    }
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
    let best = null;
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
    return best;
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
    const t = target[i];
    if (t == null) {
        return false;
    }
    if (!exists[t]) {
        return false
    }
    return isInAttackRange(i,t);
}

export function update(realTimeMs, ticksMs, timeDeltaMs)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState } = gameState.entities;
    // move, collide
    forAllEntities((i) => {
        vecAddTo(pos[i], vel[i]);
    });

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
                    hp[target[i]] -= unit[i].weapon.damage;
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
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        if (state[i] == STATE.DO_NOTHING) {
            continue;
        }
        const toEnemyBase = vecSub(gameState.bases[enemyTeam(team[i])].pos, pos[i]);
        const distToEnemyBase = vecLen(toEnemyBase);
        const toEndOfLane = vecSub(laneEnd(lane[i], team[i]), pos[i]);
        const distToEndOfLane = vecLen(toEndOfLane);
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
                if (nearestAtkTarget != null) {
                    state[i] = STATE.ATTACK;
                    target[i] = nearestAtkTarget;
                } else if (nearestChaseTarget != null) {
                    state[i] = STATE.CHASE;
                    target[i] = nearestChaseTarget;
                }
                break;
            }
            case STATE.CHASE:
            {
                // switch to attack if in range
                if (nearestAtkTarget != null) {
                    state[i] = STATE.ATTACK;
                    target[i] = nearestAtkTarget;
                    atkState[i].timer = unit[i].weapon.aimMs;
                    atkState[i].state = ATKSTATE.AIM;

                // otherwise always chase nearest
                } else if (nearestChaseTarget != null) {
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
                    target[i] = null;
                }
                /*
                 * If we can't attack the current target, target[i] is null here;
                 * Try to pick a new target, or start chasing
                 */
                if (target[i] == null) {
                    if (nearestAtkTarget != null) {
                        target[i] = nearestAtkTarget;
                        atkState[i].timer = unit[i].weapon.aimMs;
                        atkState[i].state = ATKSTATE.AIM;

                    } else if (nearestChaseTarget != null) {
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
                target[i] = null;
                atkState[i].state = ATKSTATE.NONE;
                break;
            }
            case STATE.CHASE:
            {
                const t = target[i];
                const toTarget = vecSub(pos[t], pos[i]);
                const distToTarget = vecLen(toTarget);
                if (distToTarget > 0.0001) {
                    const dir = vecMul(toTarget, 1/distToTarget);
                    vel[i] = vecMul(dir, Math.min(unit[i].speed, distToTarget));
                }
                break;
            }
            case STATE.ATTACK:
            {
                console.assert(target[i] != null);
                const t = target[i];
                vecClear(vel[i]); // stand still
            }
            break;
        }
    }

    // reap/spawn
    forAllEntities((i) => {
        if (hp[i] <= 0) {
            exists[i] = false;
            // add to free list
            gameState.entities.nextFree[i] = gameState.freeSlot;
            gameState.freeSlot = i;
        }
    });

    if (gameState.input.keyQ && !gameState.lastInput.keyQ) {
        spawnEntityInLane(gameState.lanes[0], TEAM.ORANGE, units.circle);
    }
    if (gameState.input.keyW && !gameState.lastInput.keyW) {
        spawnEntityInLane(gameState.lanes[0], TEAM.BLUE, units.circle);
    }

    gameState.lastInput = makeInput(gameState.input);
}