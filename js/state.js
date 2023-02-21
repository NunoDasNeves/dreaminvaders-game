import * as Utils from "./util.js";
import * as Data from "./data.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(Data).forEach(([name, exported]) => window[name] = exported);

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

export let gameState = {};

/*
 * Reference to an entity that is allowed to persist across more than one frame
 * You gotta check isValid before using it
 * TODO enforce it better; i.e. use a getter that return null if it's not valid anymore
 */
export const INVALID_ENTITY_INDEX = -1;
export const INVALID_ENTITY_ID = -1n;
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
        const { exists, id } = gameState.entities;
        const idx = this.index;
        if (idx < 0 || idx >= exists.length) {
            return false;
        }
        return exists[idx] && (id[idx] == this.id);
    }
    getIndex() {
        if (this.isValid()) {
            return this.index;
        }
        return INVALID_ENTITY_INDEX;
    }
}

export const ENTITY = Object.freeze({
    NONE: 0,
    UNIT: 1,
    VFX: 2,
});

const entityDefaults = Object.freeze({
    /*
     * If exists is false,
     * everything except nextFree is invalid
     */
    exists: false,
    /*
     * Pointer to next free entity,
     * only valid if exists == false
     */
    nextFree: INVALID_ENTITY_INDEX,
    /*
     * Globally unique id for differentiating entities,
     * due to the fact slots are reused
     */
    id: INVALID_ENTITY_ID,
    /* Set this when it's time for entity to be freed */
    freeable: false,
    /* type is shorthand for 'these components are present' */
    type: ENTITY.NONE,
    /* Rest of the components... null == not present */
    homeIsland: null,
    team: null,
    color: null,
    playerId: null,
    unit: null,
    hp: null,
    pos: null,
    vel: null,
    maxVel: null,
    accel: null,
    maxAccel: null,
    angle: null,
    angVel: null,
    target: null,
    lane: null,
    laneIdx: null,
    atkState: null,
    aiState: null,
    physState: null,
    hitState: null,
    animState: null,
    vfxState: null,
    debugState: null,
});

function resetEntity(i)
{
    for (const [key, val] of Object.entries(entityDefaults)) {
        gameState.entities[key][i] = val;
    }
}

export function reapFreeableEntities()
{
    const { exists, freeable, nextFree, type } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (exists[i] && freeable[i]) {
            exists[i] = false;
            // add to free list
            nextFree[i] = gameState.freeSlot;
            gameState.freeSlot = i;
        }
    };
}

export function createEntity(eType)
{
    const { exists, id, nextFree, freeable, type } = gameState.entities;
    const len = exists.length;
    let idx = gameState.freeSlot;
    if (idx == INVALID_ENTITY_INDEX) {
        for (const [key, arr] of Object.entries(gameState.entities)) {
            arr.push(entityDefaults[key]);
        }
        idx = len;
        nextFree[idx] = INVALID_ENTITY_INDEX;
        // freeSlot remains invalid because we use up the slot
    } else {
        console.assert(!exists[idx]);
        gameState.freeSlot = nextFree[idx];
        resetEntity(idx);
    }

    exists[idx]     = true;
    freeable[idx]   = false;
    id[idx]         = gameState.nextId;
    gameState.nextId++;
    type[idx]       = eType;

    return idx;
}

export function spawnVFXLastHitText(string, point, textSize, color)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = point;
    vfxState[idx] = {
        type: VFX.TEXT,
        color,
        textSize,
        string,
        timeMs: 500,
        totalTimeMs: 500,
    };
}

export function spawnVFXScream(point)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = point;
    vfxState[idx] = {
        type: VFX.SCREAM,
        timeMs: 500,
        totalTimeMs: 500,
    };
}

export function spawnVFXStaticDBeam(startPos, endPos, color)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = startPos;
    vfxState[idx] = {
        type: VFX.STATICD_BEAM,
        color,
        endPos,
        timeMs: 300,
        totalTimeMs: 300,
    };
    return idx;
}

export function spawnVFXBigEyeBeam(i, hitPos)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = pos[i];
    vfxState[idx] = {
        type: VFX.BIGEYE_BEAM,
        hitPos,
        timeMs: 600,
        totalTimeMs: 600,
    };
    return idx;
}

export function spawnVFXTankSparks(i, hitPos)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = pos[i];
    const traceParticles = [];
    const hitAngle = vecToAngle(vecSub(hitPos, pos[i]));
    for (let p = 0; p < 5; ++p) {
        const pAngle = hitAngle + Math.random()*(Math.PI/4) - Math.PI/8; 
        const pVel = vecMulBy(vecFromAngle(pAngle), 1+Math.random());
        traceParticles.push({
            pos: vecClone(pos[i]),
            vel: pVel,
            accel: vec(),
            width: 2,
            color: "rgba(255,255,255,1)",
        });
    }
    vfxState[idx] = {
        type: VFX.TANK_SPARKS,
        timeMs: 200,
        totalTimeMs: 200,
        traceParticles,
    };
    return idx;
}

export function spawnVFXExplosion(aPos, radius, timeMs)
{
    const { pos, vfxState } = gameState.entities;
    const idx = createEntity(ENTITY.VFX);
    pos[idx] = aPos;
    vfxState[idx] = {
        type: VFX.EXPLOSION,
        timeMs,
        totalTimeMs: timeMs,
        radius,
    };
    return idx;
}

export function spawnUnit(aPos, aTeamId, aPlayerId, aColor, aUnit, aHomeIsland = null, aLaneIdx = null)
{
    const { homeIsland, team, color, playerId, unit, hp, pos, vel, maxVel, accel, maxAccel, angle, angVel, target, lane, laneIdx, atkState, aiState, physState, hitState, animState, debugState } = gameState.entities;

    if (aUnit.collides && getCollidingWithCircle(aPos, aUnit.radius).length > 0) {
        console.warn("Can't spawn entity there");
        return INVALID_ENTITY_INDEX;
    }

    const idx = createEntity(ENTITY.UNIT);

    homeIsland[idx] = aHomeIsland;
    team[idx]       = aTeamId;
    color[idx]      = aColor;
    playerId[idx]   = aPlayerId;
    unit[idx]       = aUnit;
    hp[idx]         = aUnit.hp;
    pos[idx]        = vecClone(aPos);
    vel[idx]        = vec();
    maxVel[idx]     = unit[idx].topSpeed;
    accel[idx]      = vec();
    maxAccel[idx]   = unit[idx].accel;
    angle[idx]      = 0;
    angVel[idx]     = 0; // not used yet
    // possibly lane, and probably target, should be in aiState
    lane[idx]       = aLaneIdx == null || aPlayerId == NO_PLAYER_INDEX ? null : gameState.islands[aPlayerId].lanes[aLaneIdx];
    laneIdx[idx]    = aLaneIdx;
    target[idx]     = new EntityRef(INVALID_ENTITY_INDEX);
    // aiState, atkState, hitState are pretty interlinked
    const hasSpawnTime = unit[idx].spawnTimeMs > 0;
    aiState[idx]    = {
        state: hasSpawnTime ? AISTATE.NONE : unit[idx].defaultAiState,
        behavior: aUnit.aiBehavior,
    };
    atkState[idx]   = {
        state: ATKSTATE.AIM,
    };
    hitState[idx]   = {
        state: hasSpawnTime ? HITSTATE.SPAWN : HITSTATE.ALIVE,
        hitTimer: 0,
        hpBarTimer: 0,
        deadTimer: 0,
        fallTimer: 0,
        spawnTimer: unit[idx].spawnTimeMs,
    };
    physState[idx]  = {
        canCollide: unit[idx].collides,
        colliding: false,
        canFall: unit[idx].canFall,
        collRadius: unit[idx].radius,
    };
    animState[idx]  = {
        sprite: unitSprites[aUnit.defaultSpriteId],
        anim: ANIM.IDLE,
        frame: 0,
        timer: 0, // counts UP
        loop: true,
    };
    debugState[idx] = {}; // misc debug stuff

    return idx;
}

export function spawnUnitForPlayer(pos, playerId, unit, laneIdx=null)
{
    const { angle } = gameState.entities;
    const player = gameState.players[playerId];
    const teamId = player.team;
    const color = player.color;
    const island = player.island;
    const idx =  spawnUnit(pos, teamId, playerId, color, unit, island, laneIdx);
    if (idx != INVALID_ENTITY_INDEX) {
        if (playerId > 0) {
            angle[idx] = Math.PI;
        }
    }
    return idx;
}

export function spawnUnitInLane(laneIdx, playerId, unit)
{
    const player = gameState.players[playerId];
    const pos = player.island.lanes[laneIdx].spawnPos;
    const randPos = vecAdd(pos, vecMulBy(vecRand(), params.spawnPlatRadius*0.9));
    return spawnUnitForPlayer(randPos, playerId, unit, laneIdx);
}

export function addNextLhDreamer(playerId)
{
    const { pos, animState } = gameState.entities;
    const player = gameState.players[playerId];
    const num = player.island.dreamers.length;
    if (num > 3) {
        console.error("too many lh dreamers");
        return INVALID_ENTITY_INDEX;
    }
    const spawnPos = pos[player.island.idx];
    const unit = units[UNIT.LH_DREAMER];
    const idx = spawnUnitForPlayer(spawnPos, playerId, unit);
    if (idx != INVALID_ENTITY_INDEX) {
        animState[idx].sprite = unitSprites[SPRITE[`LH_DREAMER_${num}`]];
        const dreamer = makeDreamerState(idx, params.lhDreamerGoldTimeMs);
        player.island.dreamers.push(dreamer);
    }
    return idx;
}

export function getLocalPlayer()
{
    return gameState.players[gameState.localPlayerId];
}

export const PLAYER_CONTROLLER = Object.freeze({
    LOCAL_HUMAN: 0,
    BOT: 1,
});

export const BOT = Object.freeze({
    RANDOM: 0,
    AGGRO: 1
});

function addPlayer({name, controller}, pos, team, colorIdx)
{
    const id = gameState.players.length;
    gameState.players.push({
        name,
        controller,
        mouseEnabled: false,
        laneSelected: 0,
        laneSpawnHovered: -1,
        unitSelected: -1,
        id,
        color: params.playerColors[colorIdx],
        colorIdx, // need this for sprites that use playerColors
        team,
        souls: 0,
        soulsFromUnitsKilled: 0,
        soulsFromLighthouse: 0,
        soulsEarned: 0,
        gold: params.startingGold,
        goldPerSec: 0,
        goldBaseEarned: 0,
        goldFromDreamers: 0,
        goldFromEcoUpgrades: 0,
        goldEarned: 0,
        /* */
        island: {
            pos,
            idx: INVALID_ENTITY_INDEX,
            paths: [],
            lanes: [],
            sprite: envSprites.island,
            flipSprite: id == 1,
            dreamers: [],
        },
        upgradeLevels: Object.fromEntries(Object.values(upgrades).map(({ id }) => [id, -1])),
        unitCds: Object.fromEntries(Object.values(UNIT).map(id => [id, 0])),
        unitUnlocked: Object.fromEntries(Object.values(units).map(({ id, unlockCost }) => [id, unlockCost == 0])),
        botState: {
            actionTimer: 0,
            strategy: BOT.RANDOM,
            goldActions: [],
            soulActions: [],
        },
    });
    return id;
}

export function getUnitDamage(playerId, unit)
{
    const player = gameState.players[playerId];
    const upgradeLevel = player.upgradeLevels[UPGRADE.ATK];
    const weapon = getUnitWeapon(unit);
    const base = weapon.damage;
    let bonus = 0;
    if (upgradeLevel >= 0) {
        bonus = upgrades[UPGRADE.ATK].damageBonus[unit.id][upgradeLevel];
    }
    return base + bonus;
}

export function getUnitArmor(playerId, unit)
{
    const player = gameState.players[playerId];
    const upgradeLevel = player.upgradeLevels[UPGRADE.DEF];
    const base = unit.armor;
    let bonus = 0;
    if (upgradeLevel >= 0) {
        bonus = upgrades[UPGRADE.DEF].armorBonus[unit.id][upgradeLevel];
    }
    return base + bonus;
}

export function makeGameConfig(p0name, p0controller, p1name, p1controller)
{
    return {
        players: [
            {
                name: p0name,
                controller: p0controller,
            }, {
                name: p1name,
                controller: p1controller,
            }
        ]
    }
}

function makeDreamerState(dreamerIdx, goldTimeMs)
{
    return { idx: dreamerIdx, timer: goldTimeMs, goldEarned: 0, targetPos: vec() };
}

export function initGameState(gameConfig)
{
    gameState.entities =
        Object
        .keys(entityDefaults)
        .reduce((acc, key) => {
                    acc[key] = [];
                    return acc;
                }, {});
    gameState.freeSlot = INVALID_ENTITY_INDEX;
    gameState.nextId = 0n; // bigint
    gameState.camera = {
            pos: vec(),
            scale: 1, // scale +++ means zoom out
            currScaleIdx: 7,
            scaleFactors: [ 1/8, 1/7, 1/6, 1/5, 1/4, 1/3, 1/2, 1, 1.25, 1.5, 2 ],
            easeFactor: 0.1
        };
    gameState.players = [];
    gameState.islands = [];
    gameState.bridges = [];
    gameState.localPlayerId = 0;
    gameState.input = makeInput();
    gameState.lastInput = makeInput();
    const playerConfigs = gameConfig.players;
    addPlayer(playerConfigs[0], vec(-600, 0), 0, 0);
    addPlayer(playerConfigs[1], vec(600, 0), 1, 1);
    if (playerConfigs[0].controller == PLAYER_CONTROLLER.LOCAL_HUMAN) {
        if (playerConfigs[1].controller != PLAYER_CONTROLLER.LOCAL_HUMAN) {
            gameState.players[0].mouseEnabled = true;
        }
    }
    // compute the lane start and end points (bezier curves)
    // line segements approximating the curve (for gameplay code) + paths to the lighthouse
    // NOTE: assumes 2 players, PLAYER.ONE on the left, PLAYER.TWO on the right
    const islands = [
        gameState.players[0].island,
        gameState.players[1].island,
    ];
    gameState.islands = islands;
    const islandPos = islands.map(island => island.pos);
    const lighthouseOffsets = [
        vec(params.lighthouseOffsetX, params.lighthouseOffsetY),
        vec(-params.lighthouseOffsetX, params.lighthouseOffsetY),
    ];
    const lighthousePos = [
        vecAdd(islandPos[0], lighthouseOffsets[0]),
        vecAdd(islandPos[1], lighthouseOffsets[1]),
    ];
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
        const p0Lane = {
            spawnPos: pLaneStart,
            bridgeDir: vecNormalize(vecSub(bridgePoints[1], pLaneStart)),
            otherPlayerIdx: 1,
        };
        const p1Lane = {
            spawnPos: pLaneEnd,
            bridgeDir: vecNormalize(vecSub(bridgePoints[bridgePoints.length - 2], pLaneEnd)),
            otherPlayerIdx: 0,
        };
        gameState.players[0].island.lanes.push(p0Lane);
        gameState.players[1].island.lanes.push(p1Lane);
        const dreamerIdx = spawnUnit(middlePos, NO_TEAM_INDEX, NO_PLAYER_INDEX, params.neutralColor, units[Data.UNIT.DREAMER], null, i);
        const dreamer = makeDreamerState(dreamerIdx, params.dreamerGoldTimeMs);
        gameState.bridges.push({
            playerLanes: { 0: p0Lane, 1: p1Lane },
            dreamer,
            bridgePoints,
            pathPoints,
            bezierPoints,
            middlePos,
        });
        // TODO probably don't need these
        islands[0].paths.push([vecClone(pLaneStart), islandPos[0], lighthousePos[0]]);
        islands[1].paths.push([vecClone(pLaneEnd), islandPos[1], lighthousePos[1]]);
    }

    // spawn lighthouses, initial players' dreamers
    for (let i = 0; i < gameState.players.length; ++i) {
        const player = gameState.players[i];
        player.island.idx = spawnUnitForPlayer(lighthousePos[i], i, units[UNIT.BASE]);
        // select middle lane by default
        player.laneSelected = Math.floor(player.island.lanes.length/2);
        addNextLhDreamer(i);
    }
}

export function getEnemyPlayerByTeam(teamId) {
    for (const player of gameState.players) {
        if (player.team != teamId) {
            return player;
        }
    }
    return null;
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

export function mouseLeftPressed()
{
    return gameState.input.mouseLeft && !gameState.lastInput.mouseLeft;
}

export function mouseRightPressed()
{
    return gameState.input.mouseRight && !gameState.lastInput.mouseRight;
}

export function keyPressed(k)
{
    return gameState.input.keyMap[k] && !gameState.lastInput.keyMap[k];
}

export function getCollidingWithCircle(aPos, aRadius)
{
    const { exists, team, unit, hp, pos, vel, angle, angVel, state, lane, target, atkState, physState } = gameState.entities;
    const colls = [];
    for (let j = 0; j < exists.length; ++j) {
        if (!entityExists(j, ENTITY.UNIT)) {
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

export function entityExists(i, eType)
{
    const { exists, type } = gameState.entities;
    console.assert(i >= 0 && i < exists.length);
    return exists[i] && type[i] == eType;
}

export function facingRight(angle)
{
    return vecFromAngle(angle).x >= 0;
}

export function getDreamerHeadOffset(i)
{
    const { angle, animState } = gameState.entities;
    const sprite = animState[i].sprite;
    const off = vecClone(sprite.headOffset);
    const flip = !facingRight(angle[i]);
    if (flip) {
        off.x = -off.x;
    }
    return off;
}
