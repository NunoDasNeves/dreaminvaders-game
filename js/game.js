import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

let canvas = null;
let context = null;

const backgroundColor = "#1f1f1f";
const basefadeColor = "#101010";
const laneColor = "#dddddd";
const laneWidth = 60;
const baseRadius = 200;
const baseVisualRadius = 250;
const laneDistFromBase = baseRadius - 10;
const teamColors = [ "#6f6f6f", "#ff8800", "#0088ff" ];
const TEAM = {
    NONE: 0,
    ORANGE: 1,
    BLUE: 2,
}

let gameState = null;

const weapons = {
    elbow: {
        // TODO
    }
};

const units = {
    circle: {
        weapon: {},
        speed: 4,
        angSpeed: 1,
        drawFn(pos, angle, team) {
            drawCircle(pos, 10, teamColors[team]);
        }
    },
};

function laneStart(lane, team)
{
    const basePos = gameState.bases[team].pos;
    let minDist = Infinity;
    let minPoint = lane.points[0];
    for (let i = 0; i < lane.points.length; ++i) {
        const dist = vecLen(vecSub(lane.points[i], basePos));
        if (dist < minDist) {
            minDist = dist;
            minPoint = lane.points[i]
        }
    }
    return minPoint;
}

function spawnEntityInLane(aLane, aTeam, aUnit, aWeapon)
{
    const { slot, team, unit, weapon, pos, vel, angle, angVel, state, lane } = gameState.entities;
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
    pos[idx]    = laneStart(aLane, aTeam);
    vel[idx]    = vec();
    angle[idx]  = 0;
    angVel[idx] = 0;
    state[idx]  = {};
}

export function initGame()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");

    gameState = {
        entities: {
            slot: [],
            team: [],
            unit: [],
            weapon: [],
            pos: [],
            vel: [],
            angle: [],
            angVel: [],
            state: [],
            lane: [],
        },
        freeSlot: -1,
        bases: {
            [TEAM.ORANGE]: { pos: { x: -600, y: -400 } },
            [TEAM.BLUE]: { pos: { x: 600, y: 400 } },
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
    spawnEntityInLane(gameState.lanes[0], TEAM.ORANGE, units.circle, weapons.elbow)
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

}