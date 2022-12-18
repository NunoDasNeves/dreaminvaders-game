import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { params, AISTATE, HITSTATE, TEAM, ATKSTATE, weapons, units } from "./data.js";

/*
 * Game state init and related helpers
 */

export function enemyTeam(team)
{
    return (team % 2) + 1;
}

export function closestPoint(arr, pos)
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

export function laneStart(lane, team)
{
    const base = gameState.bases[team];
    return vecClone(closestPoint(lane.points, base.pos));
}

export function laneEnd(lane, team)
{
    const base = gameState.bases[enemyTeam(team)];
    return vecClone(closestPoint(lane.points, base.pos));
}

export let gameState = null;

/*
 * Reference to an entity that is allowed to persist across more than one frame
 * You gotta check isValid before using it
 * TODO enforce it better; i.e. use a getter that return null if it's not valid anymore
 */
export const INVALID_ENTITY_INDEX = -1;
export class EntityRef {
    constructor(index) {
        this.index = index;
        if (index >= 0 && index < gameState.entities.exists.length) {
            this.id = gameState.entities.id[index];
        } else {
            this.index = INVALID_ENTITY_INDEX;
        }
    }
    invalidate() {
        this.index = INVALID_ENTITY_INDEX;
    }
    isValid() {
        if (this.index < 0) {
            return false;
        }
        return gameState.entities.exists[this.index] && (gameState.entities.id[this.index] == this.id);
    }
    getIndex() {
        if (this.isValid()) {
            return this.index;
        }
        return INVALID_ENTITY_INDEX;
    }
}

export function spawnEntity(aPos, aTeam, aUnit, aLane = null)
{
    const { exists, freeable, id, nextFree, team, unit, hp, pos, vel, accel, angle, angVel, state, target, lane, atkState, aiState, physState, boidState, hitState } = gameState.entities;

    if (getCollidingWithCircle(aPos, aUnit.radius).length > 0) {
        console.warn("Can't spawn entity there");
        return INVALID_ENTITY_INDEX;
    }

    const len = exists.length;
    if (gameState.freeSlot == INVALID_ENTITY_INDEX) {
        for (const [key, arr] of Object.entries(gameState.entities)) {
            arr.push(null);
        }
        nextFree[len] = INVALID_ENTITY_INDEX;
        gameState.freeSlot = len;
    }
    let idx = gameState.freeSlot;
    gameState.freeSlot = nextFree[idx];

    exists[idx]     = true;
    freeable[idx]   = false;
    id[idx]         = gameState.nextId;
    gameState.nextId++;
    nextFree[idx]   = INVALID_ENTITY_INDEX;
    team[idx]       = aTeam;
    unit[idx]       = aUnit;
    hp[idx]         = aUnit.maxHp;
    pos[idx]        = vecClone(aPos);
    vel[idx]        = vec();
    accel[idx]      = vec(); // not used yet
    angle[idx]      = 0;
    angVel[idx]     = 0; // not used yet
    // possibly lane, and probably target, should be in aiState
    lane[idx]       = aLane;
    target[idx]     = new EntityRef(INVALID_ENTITY_INDEX);
    // aiState, atkState, hitState are pretty interlinked
    aiState[idx]    = {
        state: unit[idx].defaultAiState
    };
    atkState[idx]   = {
        state: ATKSTATE.NONE,
        timer: 0,
    };
    hitState[idx]   = {
        state: HITSTATE.ALIVE,
        hitTimer: 0,
        hpBarTimer: 0,
        deadTimer: 0,
        fallTimer: 0,
    };
    physState[idx]  = {
        canCollide: unit[idx].collides,
        colliding: false,
        canFall: unit[idx].canFall,
    };
    // gonna be folded in or removed at some point
    boidState[idx]  = {
        targetPos: null,
        avoiding: false,
        avoidDir: 0,
        avoidanceForce: vec(),
        seekForce: vec()
    };

    return idx;
}

export function spawnEntityInLane(aLane, aTeam, aUnit)
{
    const pos = laneStart(aLane, aTeam);
    const randVec = vecMulBy(vecRand(), params.laneWidth/2);
    vecAddTo(pos, randVec);
    return spawnEntity(pos, aTeam, aUnit, aLane);
}

function makeInput()
{
    return {
            mousePos: vec(),
            mouseScreenPos: vec(),
            mouseScrollDelta: 0,
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false,
            keyMap: {},
        };
}

export function updateGameInput()
{
    const input = gameState.input;
    const lastInput = gameState.lastInput;

    vecCopyTo(lastInput.mousePos, input.mousePos);
    vecCopyTo(lastInput.mouseScreenPos, input.mouseScreenPos);
    lastInput.mouseScrollDelta = input.mouseScrollDelta;
    input.mouseScrollDelta = 0;
    lastInput.mouseLeft = input.mouseLeft;
    lastInput.mouseMiddle = input.mouseMiddle;
    lastInput.mouseRight = input.mouseRight;
    for (const [key, val] of Object.entries(input.keyMap)) {
        lastInput.keyMap[key] = val;
    }
}

export function initGameState()
{
    gameState = {
        entities: {
            exists: [],
            freeable: [],
            id: [],
            nextFree: [],
            team: [],
            unit: [],
            hp: [],
            pos: [],
            vel: [],
            accel: [],
            angle: [],
            angVel: [],
            target: [],
            targettable: [],
            lane: [],
            aiState: [],
            atkState: [],
            physState: [],
            boidState: [],
            hitState: [],
        },
        freeSlot: INVALID_ENTITY_INDEX,
        nextId: 0n, // bigint
        bases: {
            [TEAM.ORANGE]: { pos: { x: -600, y: -400 }, idx: INVALID_ENTITY_INDEX },
            [TEAM.BLUE]: { pos: { x: 600, y: 400 }, idx: INVALID_ENTITY_INDEX },
        },
        lanes: [],
        camera: {
            pos: vec(),
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
            vecAdd(gameState.bases[TEAM.ORANGE].pos, vecMul(orangeToBlue, params.laneDistFromBase)),
            vecAdd(gameState.bases[TEAM.BLUE].pos, vecMul(orangeToBlue, -params.laneDistFromBase)),
        ]
    });

    gameState.bases[TEAM.BLUE].idx = spawnEntity(gameState.bases[TEAM.BLUE].pos, TEAM.BLUE, units.base, weapons.none);
    gameState.bases[TEAM.ORANGE].idx = spawnEntity(gameState.bases[TEAM.ORANGE].pos, TEAM.ORANGE, units.base, weapons.none);
}

// Convert camera coordinates to world coordinates with scale
export function cameraToWorld(x, y) {
    return {x: (x - gameState.camera.width / 2) * gameState.camera.scale + gameState.camera.pos.x,
            y: (y - gameState.camera.height / 2) * gameState.camera.scale + gameState.camera.pos.y};
}
export function cameraVecToWorld(v)
{
    return cameraToWorld(v.x, v.y);
}

// Convert world coordinates to camera coordinates with scale
export function worldToCamera(x, y) {
    return {x: (x - gameState.camera.pos.x) / gameState.camera.scale + gameState.camera.width / 2,
            y: (y - gameState.camera.pos.y) / gameState.camera.scale + gameState.camera.height / 2};
}
export function worldVecToCamera(v) {
    return worldToCamera(v.x, v.y);
}

export function updateCameraSize(width, height)
{
    gameState.camera.width = width;
    gameState.camera.height = height;
}

export function updateKey(key, pressed)
{
    gameState.input.keyMap[key] = pressed;
}

export function updateMousePos(event, canvasClientBoundingRect)
{
    const v = vec(
        event.clientX - canvasClientBoundingRect.left,
        event.clientY - canvasClientBoundingRect.top
    );
    gameState.input.mouseScreenPos = v;
    gameState.input.mousePos = cameraVecToWorld(v);
}

export function updateMouseClick(button, pressed)
{
    switch (button) {
        case 0:
            gameState.input.mouseLeft = pressed;
            break;
        case 1:
            gameState.input.mouseMiddle = pressed;
            break;
        case 2:
            gameState.input.mouseRight = pressed;
            break;
    }
}

export function updateMouseWheel(y)
{
    gameState.input.mouseScrollDelta = y;
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