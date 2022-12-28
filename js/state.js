import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { params, NO_PLAYER_INDEX, NO_TEAM_INDEX, AISTATE, HITSTATE, ATKSTATE, ANIM, weapons, units, debug } from "./data.js";

/*
 * Game state init and related helpers
 */

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

export function spawnEntity(aPos, aTeamId, aPlayerId, aColor, aUnit, aHomeIsland = null, aLane = null)
{
    const { exists, freeable, id, nextFree, homeIsland, team, color, playerId, unit, hp, pos, vel, accel, angle, angVel, target, lane, atkState, aiState, physState, boidState, hitState, animState, debugState } = gameState.entities;

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
    homeIsland[idx] = aHomeIsland;
    team[idx]       = aTeamId;
    color[idx]      = aColor;
    playerId[idx]   = aPlayerId;
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
    animState[idx]  = {
        anim: ANIM.IDLE,
        frame: 0,
        timer: 0,
        loop: true,
    };
    debugState[idx] = {}; // misc debug stuff
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

export function spawnEntityForPlayer(pos, playerId, unit, lane=null)
{
    const player = gameState.players[playerId];
    const teamId = player.team;
    const color = player.color;
    const island = player.island;
    return spawnEntity(pos, teamId, playerId, color, unit, island, lane);
}

export function spawnEntityInLane(laneIdx, playerId, unit)
{
    const player = gameState.players[playerId];
    const lane = player.island.lanes[laneIdx];
    const pos = lane.spawnPos;
    const randPos = vecAdd(pos, vecMulBy(vecRand(), params.laneWidth*0.5));
    return spawnEntityForPlayer(randPos, playerId, unit, lane);
}

export function getLocalPlayer()
{
    return gameState.players[gameState.localPlayerId];
}

export const PLAYER_CONTROLLER = Object.freeze({
    LOCAL_HUMAN: 0,
    BOT: 1,
});

function addPlayer(controller, pos, team, colorIdx)
{
    const id = gameState.players.length;
    gameState.players.push({
        controller,
        laneSelected: 0,
        laneHovered: -1,
        id,
        color: params.playerColors[colorIdx],
        colorIdx, // need this for sprites that use playerColors
        team,
        gold: params.startingGold,
        goldPerSec: params.startingGoldPerSec,
        island: {
            pos,
            idx: INVALID_ENTITY_INDEX,
            paths: [],
            lanes: [],
        },
        unitCds: Object.fromEntries(Object.values(units).map(({ id }) => [id, 0])),
    });
    return id;
}

export function initGameState(player0Controller, player1Controller)
{
    gameState = {
        entities: {
            exists: [],
            freeable: [],
            id: [],
            nextFree: [],
            homeIsland: [],
            team: [],
            color: [],
            playerId: [],
            unit: [],
            hp: [],
            pos: [],
            vel: [],
            accel: [],
            angle: [],
            angVel: [],
            target: [],
            lane: [],
            aiState: [],
            atkState: [],
            physState: [],
            boidState: [],
            hitState: [],
            animState: [],
            debugState: [],
        },
        freeSlot: INVALID_ENTITY_INDEX,
        nextId: 0n, // bigint
        camera: {
            pos: vec(),
            scale: 1, // scale +++ means zoom out
            easeFactor: 0.1
        },
        players: [],
        islands: [],
        lanes: [],
        localPlayerId: 0,
        mouseSelectLane: true,
        input: makeInput(),
        lastInput: makeInput(),
    };
    if (player0Controller == PLAYER_CONTROLLER.LOCAL_HUMAN &&
        player1Controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        gameState.mouseSelectLane = false;
    }
    addPlayer(player0Controller, vec(-600, 0), 0, 0);
    addPlayer(player1Controller, vec(600, 0), 1, 1);
    // compute the lane start and end points (bezier curves)
    // line segements approximating the curve (for gameplay code) + paths to the lighthouse
    // NOTE: assumes 2 players, PLAYER.ONE on the left, PLAYER.TWO on the right
    const islands = [
        gameState.players[0].island,
        gameState.players[1].island,
    ];
    gameState.islands = islands;
    const islandPos = islands.map(island => island.pos);
    const islandToIsland = vecSub(islandPos[1], islandPos[0]);
    const centerPoint = vecAddTo(vecMul(islandToIsland, 0.5), islandPos[0]);
    const islandToLaneStart = vec(params.laneDistFromBase, 0);
    const angleInc = Math.PI/4;
    const angleSpan = (params.numLanes - 1) * angleInc;
    const angleStart = -angleSpan*0.5;
    const ctrlPointInc = params.laneWidth * 4;
    const ctrlPointSpan = (params.numLanes - 1) * ctrlPointInc;
    const ctrlPointStart = -ctrlPointSpan*0.5;
    const ctrlPointXOffset = vecLen(islandToIsland)/5;
    for (let i = 0; i < params.numLanes; ++i) {
        const numSegs = params.minNumLaneSegs + Math.floor(Math.abs(i - (params.numLanes - 1)*0.5));
        const pathPoints = []; // points all the way from lighthouse to lighthouse
        const bridgePoints = []; // just the bridge points (edge of island to edge of island)
        const bezierPoints = []; // bezier points, just for drawing lanes
        pathPoints.push(islandPos[0]);
        // vector from island center to lane start at the edge
        const off = vecRotateBy(vecRotateBy(vecClone(islandToLaneStart), angleStart), angleInc * i);
        const pLaneStart = vecAdd(islandPos[0], off);
        pathPoints.push(pLaneStart);
        bridgePoints.push(pLaneStart);
        bezierPoints.push(pLaneStart);
        // center bezier points
        const centerControlPoint = vecAdd(centerPoint, vec(0, ctrlPointStart + ctrlPointInc*i));
        // assume going left to right here, so -x then +x
        bezierPoints.push(vecAdd(centerControlPoint, vec(-ctrlPointXOffset,0)));
        bezierPoints.push(vecAdd(centerControlPoint, vec(ctrlPointXOffset,0)));
        // reverse the angle in x axis for blue island
        off.x = -off.x;
        const pLaneEnd = vecAdd(islandPos[1], off);
        bezierPoints.push(pLaneEnd);
        // approximate intermediate points along bezier curve
        for (let i = 1; i < numSegs; ++i) {
            const point = cubicBezierPoint(bezierPoints,i/numSegs);
            bridgePoints.push(point);
            pathPoints.push(point);
        }
        bridgePoints.push(pLaneEnd);
        pathPoints.push(pLaneEnd);
        pathPoints.push(islandPos[1]);
        let middlePos = null;
        // create the lanes
        if (pathPoints.length & 1) {
            middlePos = pathPoints[Math.floor(pathPoints.length/2)];
        } else {
            const left = pathPoints[Math.floor(pathPoints.length/2) - 1];
            const right = pathPoints[Math.floor(pathPoints.length/2)];
            middlePos = vecMul(vecAdd(left, right), 0.5);
        }
        const bridgePointsReversed = reverseToNewArray(bridgePoints);
        const p0Lane = {
            bridgePoints,
            spawnPos: pLaneStart,
            otherPlayerIdx: 1,
        };
        const p1Lane = {
            bridgePoints: bridgePointsReversed,
            spawnPos: pLaneEnd,
            otherPlayerIdx: 0,
        };
        gameState.players[0].island.lanes.push(p0Lane);
        gameState.players[1].island.lanes.push(p1Lane);
        gameState.lanes.push({
            playerLanes: { 0: p0Lane, 1: p1Lane },
            dreamer: { playerId: NO_PLAYER_INDEX, color: params.neutralColor, timer: 0, },
            pathPoints,
            bezierPoints,
            middlePos,
        });
        // TODO probably don't need these
        islands[0].paths.push([vecClone(pLaneStart), islandPos[0]]);
        islands[1].paths.push([vecClone(pLaneEnd), islandPos[1]]);
    }

    // spawn lighthouses
    islands[0].idx = spawnEntityForPlayer(islandPos[0], 0, units.base);
    islands[1].idx = spawnEntityForPlayer(islandPos[1], 1, units.base);
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
