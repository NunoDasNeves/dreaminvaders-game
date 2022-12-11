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
const laneDistFromBase = baseRadius - 10;
const teamColors = [ "#6f6f6f", "#ff9933", "#3399ff" ];
const TEAM = Object.freeze({
    NONE: 0,
    ORANGE: 1,
    BLUE: 2,
});
const STATE = Object.freeze({
    IDLE: 0,
    PROCEED: 1,
    ATTACK: 2,
});

let gameState = null;

const weapons = {
    none: {
        range: 0,
        cooldownMs: Infinity,
        damage: 0,
        missChance: 1,
        drawFn() {}
    },
    elbow: {
        range: 3,
        cooldownMs: 1000,
        damage: 1,
        missChance: 0.3,
        drawFn(pos, angle, team, atkState) {
            const dir = vecFromAngle(angle);
            drawCircle(vecAdd(pos, vecMul(dir, 10)), 4, 'black');
        }
    }
};

const units = {
    base: {
        weapon: weapons.none,
        speed: 0,
        angSpeed: 0,
        hp: 1000,
        radius: baseRadius,
        drawFn() {}
    },
    circle: {
        weapon: weapons.elbow,
        speed: 4,
        angSpeed: 1,
        hp: 3,
        radius: 10,
        drawFn(pos, angle, team) {
            drawCircle(pos, 10, teamColors[team]);
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
    return closestPoint(lane.points, base.pos);
}

function laneEnd(lane, team)
{
    const base = gameState.bases[enemyTeam(team)];
    return closestPoint(lane.points, base.pos);
}

function spawnEntity(aPos, aTeam, aUnit, aWeapon, aLane = null)
{
    const { slot, team, unit, weapon, pos, vel, angle, angVel, radius, state, lane, atkState  } = gameState.entities;
    const len = slot.length;
    let idx = gameState.freeSlot;
    if (idx == -1) {
        for (const [key, arr] of Object.entries(gameState.entities)) {
            arr.push(null);
        }
        idx = len;
    }
    const teamBase = gameState.bases[aTeam];
    slot[idx]   = idx;
    team[idx]   = aTeam;
    lane[idx]   = aLane;
    unit[idx]   = aUnit;
    weapon[idx] = aWeapon;
    pos[idx]    = vecClone(aPos);
    vel[idx]    = vec();
    angle[idx]  = 0;
    angVel[idx] = 0;
    radius[idx] = aUnit.radius;
    state[idx]  = STATE.PROCEED;
    atkState[idx] = { atkTimer: 0 };

    return idx;
}

function spawnEntityInLane(aLane, aTeam, aUnit, aWeapon)
{
    const pos = laneStart(aLane, aTeam);
    return spawnEntity(pos, aTeam, aUnit, aWeapon, aLane);
}

export function initGame()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");

    gameState = {
        entities: {
            slot: [],
            nextFree: [],
            team: [],
            unit: [],
            weapon: [],
            pos: [],
            vel: [],
            angle: [],
            angVel: [],
            radius: [],
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
        input: {
            mousePos: { x: 0, y: 0 },
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false,
            keyR: false,
            keySpace: false
        },
    };
    const orangeToBlue = vecNorm(vecSub(gameState.bases[TEAM.BLUE].pos, gameState.bases[TEAM.ORANGE].pos));
    gameState.lanes.push({
        points: [
            vecAdd(gameState.bases[TEAM.ORANGE].pos, vecMul(orangeToBlue, laneDistFromBase)),
            vecAdd(gameState.bases[TEAM.BLUE].pos, vecMul(orangeToBlue, -laneDistFromBase)),
        ]
    });

    gameState.bases[TEAM.BLUE].unit = spawnEntity(gameState.bases[TEAM.BLUE].pos, TEAM.BLUE, units.base, weapons.none);
    gameState.entities.state[gameState.bases[TEAM.BLUE].unit] = STATE.IDLE;
    gameState.bases[TEAM.ORANGE].unit = spawnEntity(gameState.bases[TEAM.ORANGE].pos, TEAM.ORANGE, units.base, weapons.none);
    gameState.entities.state[gameState.bases[TEAM.ORANGE].unit] = STATE.IDLE;

    spawnEntityInLane(gameState.lanes[0], TEAM.ORANGE, units.circle, units.circle.weapon);
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
    if (key == 'r') {
        gameState.input.keyR = pressed;
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

function drawCircle(worldPos, radius, fillStyle)
{
    let coords = worldToCamera(worldPos.x, worldPos.y);
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

    for (let i = 0; i < gameState.entities.unit.length; ++i) {
        gameState.entities.unit[i].drawFn(gameState.entities.pos[i], gameState.entities.angle[i], gameState.entities.team[i])
    }
}

export function update(realTimeMs, ticksMs, timeDeltaMs)
{
    const { slot, team, unit, weapon, pos, vel, angle, angVel, radius, state, lane, target } = gameState.entities;
    // move, collide
    for (let i = 0; i < slot.length; ++i) {
        vecAddTo(pos[i], vel[i]);
    }
    // shoot, attack
    for (let i = 0; i < slot.length; ++i) {
        const t = target[i];
        if (t == null) {
            continue;
        }
        if (slot[t] == -1) {
            target[i] = null;
            continue;
        }
    }

    // state/AI
    for (let i = 0; i < slot.length; ++i) {
        if (state[i] == STATE.IDLE) {
            continue;
        }
        const toEndOfLane = vecSub(laneEnd(lane[i], team[i]), pos[i]);
        const distToEndOfLane = vecLen(toEndOfLane);
        const weaponRange = radius[i] + weapon[i].range;
        // change state
        switch (state[i]) {
            case STATE.PROCEED:
                if (distToEndOfLane <= weaponRange) {
                    state[i] = STATE.ATTACK;
                    vecClear(vel[i]);
                    target[i] = gameState.bases[enemyTeam(team[i])].unit;
                }
                break;
            case STATE.ATTACK:
                break;
        }
        // make decisions based on state
        switch (state[i]) {
            case STATE.PROCEED:
                const dir = vecNorm(toEndOfLane);
                vel[i] = vecMul(dir, Math.min(unit[i].speed, distToEndOfLane));
                break;
            case STATE.ATTACK:
                break;
        }
    }
    // reap/spawn
}