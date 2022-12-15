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
    drawSight: false,
    drawCapsule: true,
    drawForces: true,
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
        collides: false,
        defaultState: STATE.DO_NOTHING,
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
        collides: true,
        defaultState: STATE.PROCEED,
        drawFn(pos, angle, team) {
            fillCircle(pos, 10, teamColors[team]);
        }
    },
    boid: {
        weapon: weapons.none,
        speed: 1,
        angspeed: 0.5,
        maxHp: 1,
        sightRadius: laneWidth,
        radius:10,
        collides: true,
        defaultState: STATE.DO_NOTHING,
        drawFn(pos, angle, team) {
            fillEquilateralTriangle(pos, angle, 10, 15, teamColors[team]);
        }
    }
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
    const { exists, nextFree, team, unit, hp, pos, vel, angle, angVel, state, lane, atkState, physState, boidState  } = gameState.entities;

    if (getCollidingWithCircle(aPos, aUnit.radius).length > 0) {
        console.warn("Can't spawn entity there");
        return -1;
    }

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
    state[idx]      = unit[idx].defaultState;
    atkState[idx]   = { timer: 0, state: ATKSTATE.NONE };
    physState[idx]  = { colliding: false };
    boidState[idx]  = {
        targetPos: null,
        avoiding: false,
        avoidanceForce: vec(),
        seekForce: vec()
    };

    return idx;
}

function spawnEntityInLane(aLane, aTeam, aUnit)
{
    const pos = laneStart(aLane, aTeam);
    const randVec = vecMulBy(vecRand(), laneWidth/2);
    vecAddTo(pos, randVec);
    return spawnEntity(pos, aTeam, aUnit, aLane);
}

function makeInput()
{
    return {
            mousePos: vec(),
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false,
            mouseScroll: 0,
            keyMap: {},
        };
}

function updateGameInput()
{
    const input = gameState.input;
    const lastInput = gameState.lastInput;

    lastInput.mousePos = vecClone(input.mousePos);
    lastInput.mouseLeft = input.mouseLeft;
    lastInput.mouseMiddle = input.mouseMiddle;
    lastInput.mouseRight = input.mouseRight;
    lastInput.mouseScroll = input.mouseScroll;
    input.mouseScroll = 0; // its a delta value so reset it
    for (const [key, val] of Object.entries(input.keyMap)) {
        lastInput.keyMap[key] = val;
    }
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
            lane: [],
            atkState: [],
            physState: [],
            boidState: [],
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
        debugPause: false,
    };
    const orangeToBlue = vecNorm(vecSub(gameState.bases[TEAM.BLUE].pos, gameState.bases[TEAM.ORANGE].pos));
    gameState.lanes.push({
        points: [
            vecAdd(gameState.bases[TEAM.ORANGE].pos, vecMul(orangeToBlue, laneDistFromBase)),
            vecAdd(gameState.bases[TEAM.BLUE].pos, vecMul(orangeToBlue, -laneDistFromBase)),
        ]
    });

    gameState.bases[TEAM.BLUE].unit = spawnEntity(gameState.bases[TEAM.BLUE].pos, TEAM.BLUE, units.base, weapons.none);
    gameState.bases[TEAM.ORANGE].unit = spawnEntity(gameState.bases[TEAM.ORANGE].pos, TEAM.ORANGE, units.base, weapons.none);
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
export function worldVecToCamera(v) {
    return worldToCamera(v.x, v.y);
}

export function updateKey(key, pressed)
{
    gameState.input.keyMap[key] = pressed;
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

export function updateMouseWheel(y)
{
    gameState.input.mouseScroll = y;
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
    const teamColor = teamColors[team];
    const coords = worldToCamera(base.pos.x, base.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, (baseRadius - 50) / gameState.camera.scale, coords.x, coords.y, baseVisualRadius / gameState.camera.scale);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, basefadeColor);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, baseVisualRadius / gameState.camera.scale, 0, 2 * Math.PI);
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

    const { exists, team, unit, pos, angle, physState, boidState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        unit[i].drawFn(pos[i], angle[i], team[i])
        if (debug.drawRadii && physState[i].colliding) {
            strokeCircle(pos[i], unit[i].radius, 2, 'red');
        }
        if (debug.drawSight && unit[i].sightRadius > 0)
        {
            strokeCircle(pos[i], unit[i].sightRadius, 1, 'yellow');
        }
        if (unit[i] == units.boid)
        {
            if (debug.drawCapsule) // && unit[i].avoiding)
            {
                strokeHalfCapsule(pos[i], unit[i].sightRadius, unit[i].radius, angle[i], 1, boidState[i].avoiding ? '#00ff00' : 'green');
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

function getCollidingWithCircle(aPos, aRadius)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    const colls = [];
    for (let j = 0; j < exists.length; ++j) {
        if (!exists[j]) {
            continue;
        }
        if (!unit[j].collides) {
            continue;
        }
        const dist = getDist(aPos, pos[j]);
        if (dist < aRadius + unit[j].radius) {
            colls.push(j);
        }
    }
    return colls;

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

const minVelocity = 0.5;

function getAvoidanceForce(i, seekForce)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState, boidState } = gameState.entities;
    const bState = boidState[i];
    const avoidanceForce = vec();
    let avoidanceCount = 0;
    bState.avoiding = false;
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
        const len = vecLen(toBoid);
        // TODO don't try to avoid target[i]; we wanna go straight towards it
        // can see it
        if (len > unit[i].sightRadius) {
            continue;
        }
        // it's in front
        if (vecDot(seekForce, toBoid) < 0) {
            continue;
        }
        // half capsule check - capsule has unit[i].radius
        const lineLen = unit[i].sightRadius - unit[i].radius;
        const lineDir = vecNorm(seekForce);
        // project toBoid onto line forward
        const distAlongLine = vecDot(toBoid, lineDir);
        if (distAlongLine > lineLen) {
            // its in the capsule end
            const endOfLine = vecMul(lineDir, lineLen);
            if (getDist(endOfLine, toBoid) > unit[i].radius + unit[j].radius) {
                continue;
            }
        } else {
            // its in the line part, not the end part
            const closestPointOnLine = vecMulBy(lineDir, distAlongLine);
            if (getDist(closestPointOnLine, toBoid) > unit[i].radius + unit[j].radius) {
                continue;
            }
        }
        // okay we're in the capsule
        bState.avoiding = true;
        // get the direction
        const avoidForce = vecTangentRight(lineDir);
        const rightOrLeft = vecScalarCross(toBoid, lineDir);
        vecMulBy(avoidForce, rightOrLeft > 0 ? -1 : 1);
        // TODO its the same as closestPoint on line, meh
        const linePointClosestToBoid = vecMul(lineDir, distAlongLine);
        // force is inversely proportional to forward dist (further away = avoid less)
        vecMulBy(avoidForce, 1/distAlongLine);
        // and proportional to side dist (center of obstacle is further, so it's bigger) - not sure if this is always true
        //vecMulBy(avoidForce, 1/distAlongLine);
        //
        vecAddTo(avoidanceForce, avoidForce);
    }
    if (avoidanceCount > 0) {
        vecMulBy(avoidanceForce, 1/avoidanceCount);
    }
    bState.avoidanceForce = avoidanceForce;
    return vecMulBy(avoidanceForce, unit[i].speed);
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
            if (utils.getDist(pos[i], bState.targetPos) < (baseRadius + 5)) {
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
        // 'collision' - separation force
        const separationForce = getSeparationForce(i);
        const avoidanceForce = getAvoidanceForce(i, seekForce);

        vecAddTo(finalForce, avoidanceForce);
        vecSetMag(finalForce, unit[i].speed);
        vecCopyTo(vel[i], finalForce);
        // stop em hitting
        vecAddTo(finalForce, separationForce);
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
}

function keyPressed(k)
{
    return gameState.input.keyMap[k] && !gameState.lastInput.keyMap[k];
}

function updateGame(timeDeltaMs)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    // move, collide
    forAllEntities((i) => {
        vecAddTo(pos[i], vel[i]);
        if (getCollidingWith(i).length == 0) {
            physState[i].colliding = false;
        } else {
            physState[i].colliding = true;
        }
        if (vecLen(vel[i]) > minVelocity) {
            angle[i] = vecToAngle(vel[i]);
        }
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
        const randPos = vecMulBy(vecRand(), Math.random()*500);
        spawnEntity(randPos, TEAM.BLUE, units.boid);
    }
    if (keyPressed('r')) {
        const randPos = vecMulBy(vecRand(), Math.random()*500);
        spawnEntity(randPos, TEAM.ORANGE, units.boid);
    }
    gameState.camera.scale = clamp(gameState.camera.scale + gameState.input.mouseScroll, 0.25, 5);

    if (!gameState.debugPause || keyPressed('.')) {
        updateGame(timeDeltaMs);
    }

    updateGameInput();
}