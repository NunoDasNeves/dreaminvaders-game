import * as Utils from "./util.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

/*
 * Static data
 */

export const debug = {
    skipAppMenu: false, // launch straight into a game
    enableControls: false,
    paused: false,
    // debug drawing below here
    drawUI: false, // all the debug UI below is dependent on this
    drawAiState: true,
    drawCollision: false,
    drawSightRange: true,
    drawWeaponRange: true,
    drawAngle: false,
    drawVel: true,
    drawAccel: true,
    drawSwing: true,
    drawLaneSegs: false,
    drawBezierPoints: false,
    drawClickBridgeDebugArrow: false,
    clickedPoint: vec(),
    closestLanePoint: vec(),
    drawFPS: true,
    fps: 0,
    fpsCounter: 0,
    fpsTime: 0,
    drawNumUpdates: true,
    numUpdates: 0,
    avgUpdates: 0,
}

export const params = Object.freeze(
    function() {
        const obj = {
            numLanes: 3, // min 1, max ~6
            minNumLaneSegs: 8,
            minUnitVelocity: 0.5,
            backgroundColor: "#1f1f1f",
            baseFadeColor: "#101010",
            laneColor: "#888888",
            laneHoveredColor: "#cccccc",
            laneWidth: 60,
            laneSelectDist: 80,
            pathWidth: 40,
            pathColor: "#443322",
            lighthouseRadius: 50,
            islandRadius: 200,
            neutralColor: "#dfdfdf",
            playerColors: [ "#ff9933", "#3399ff" ],
            hpBarTimeMs: 2000,
            hitFadeTimeMs: 300,
            deathTimeMs: 1000,
            fallTimeMs: 500,
            fallSizeReduction: 0.75,
            startingGold: 10,
            startingGoldPerSec: 1,
            dreamerGoldPerSec: 0.5,
            botActionTimeMs: 2000,
        }
        obj.laneDistFromBase = obj.islandRadius - 15;
        obj.safePathDistFromBase = obj.laneDistFromBase - obj.laneWidth*0.5;
        return obj;
    }()
);

export const NO_LANE_INDEX = -1;
export const NO_PLAYER_INDEX = -1;
export const NO_TEAM_INDEX = -1;

export const AISTATE = Object.freeze({
    DO_NOTHING: 0,
    PROCEED: 1,
    CHASE: 2,
    ATTACK: 3,
});
export const ATKSTATE = Object.freeze({
    NONE: 0,
    AIM: 1,
    SWING: 2,
    RECOVER: 3,
});
export const HITSTATE = Object.freeze({
    ALIVE: 0,
    DEAD: 1,
});

/* Unit data */

export const ANIM = Object.freeze({
    IDLE: 0,
    WALK: 1,
    ATK_AIM: 2,
    ATK_SWING: 3,
    ATK_RECOVER: 4,
    DIE: 5,
    FALL: 6,
});
export const UNIT = Object.freeze({
    INVALID: 0,
    BASE: 1,
    CHOGORINGU: 2,
    BIGEYE: 3,
    TANK: 4,
});
export const VFX = Object.freeze({
    EXPLOSION: 1,
    BIGEYE_BEAM: 2,
    TANK_SPARKS: 3,
});

const unitSpriteRequired = ['id', 'filename', 'width', 'height'];
const unitSpriteDefaults = Object.freeze({
    imgAsset: null,
    centerOffset: vec(),
    rows: 1,
});
const unitAnimDefaults = Object.freeze({
    row: 0,
    col: 0,
    frames: 1,
    frameDur: 1000,
});

const unitSpriteData = [
    {
        id: UNIT.BASE,
        filename: "lighthouse.png",
        width: 128,
        height: 256,
        centerOffset: vec(0,74),
    },
    {
        id: UNIT.CHOGORINGU,
        filename: "chogoringu.png",
        imgAsset: null, // not really needed here; populated by assets.js
        // dimensions of one frame of animation
        width: 16,
        height: 24,
        centerOffset: vec(0,8), // additional offset so we draw it in the right spot in relation to entity position
        rows: 2, // not including flipped/recolored frames; used to get flip offset
        playerColors: true,
        anims: {
            // all the animations will be populated by defaults if not specified
            [ANIM.IDLE]: {
                // start at this row and col in the spritesheet
                row: 0, // defaults to 0; one animation per row
                col: 0, // defaults to 0; one frame per col
                // used by game logic to loop the anim etc
                frames: 2, // defaults to 1
                frameDur: 400, // defaults to 1000
            },
            // omitting optional fields in these
            [ANIM.WALK]: {
                row: 1,
                frames: 4,
                frameDur: 100,
            },
            [ANIM.ATK_SWING]: {
                frames: 2,
                frameDur: 400,
            },
        },
    },{
        id: UNIT.BIGEYE,
        filename: "bigeye.png",
        width: 32,
        height: 32,
        centerOffset: vec(0,3),
        rows: 2,
        playerColors: true,
        anims: {
            [ANIM.IDLE]: {
                frames: 2,
                frameDur: 300,
            },
            [ANIM.WALK]: {
                frames: 2,
                frameDur: 300,
            },
            [ANIM.ATK_AIM]: {
                row: 1,
                frames: 1,
                frameDur: 200,
            },
            [ANIM.ATK_SWING]: {
                row: 1,
                frames: 4,
                frameDur: 100,
            },
            [ANIM.ATK_RECOVER]: {
                row: 1,
                col: 3, // same frame as end of swing; i.e. double the length of that frame in anim
                frames: 4,
                frameDur: 100,
            },
        },
    },{
        id: UNIT.TANK,
        filename: "tank.png",
        width: 64,
        height: 64,
        centerOffset: vec(0,16),
        rows: 1,
        anims: { /* use defaults; see above */ },
    },
];

const weaponRequired = ['id'];
const weaponDefaults = Object.freeze({
    // range starts at edge of unit radius, so the weapon 'radius' is unit.radius + weapon.range
    range: 0,
    // time from deciding to attack until starting attack
    aimMs: Infinity,
    // time from starting attack til attack hits
    swingMs: Infinity,
    // time after attack hits til can attack again
    recoverMs: Infinity,
    // damage to HP, reduced by effective armor (after armorPen)
    damage: 0,
    // flat armor reduction, before damage is applied
    armorPen: 0,
    // can't miss twice in a row, so it's less really
    missChance: 1,
});

const weaponData = [
    {
        id: UNIT.BASE,
    },{
        id: UNIT.CHOGORINGU,
        range: 10,
        aimMs: 200,
        swingMs: 200,
        recoverMs: 300,
        damage: 6,
        missChance: 0.15,
    },{
        id: UNIT.BIGEYE,
        range: 90,
        aimMs: 300,
        swingMs: 400,
        recoverMs: 600,
        damage: 9,
        aoeRadius: 20, // radius around the hit point
        aoeMissRadius: 30, // how far away from target we might hit
        aoeAccuracy: 0.25, // higher accuracy = less chance of hitting edge of miss radius
    },{
        id: UNIT.TANK,
        range: 100,
        aimMs: 400,
        swingMs: 200,
        recoverMs: 800,
        damage: 34,
        armorPen: 2,
        missChance: 0.1,
    },
];

const unitRequired = ['id'];
const unitDefaults = Object.freeze({
    maxSpeed: 0,
    accel: 0,
    angSpeed: 0,
    maxHp: 1,
    armor: 0,
    sightRange: 0,
    radius: 10,
    collides: true,
    canFall: true,
    defaultAiState: AISTATE.DO_NOTHING,
    lighthouseDamage: 0,
    goldCost: Infinity,
    cdTimeMs: Infinity,
    draw: {},
});

const unitData = [
    {
        id: UNIT.BASE,
        maxHp: 1000,
        radius: params.lighthouseRadius,
        collides: false,
        canFall: false,
    },{
        id: UNIT.CHOGORINGU,
        maxSpeed: 2,
        accel: 0.4,
        angSpeed: 1,
        maxHp: 35,
        sightRange: params.laneWidth*0.5,
        radius: 8,
        collides: true,
        canFall: true,
        defaultAiState: AISTATE.PROCEED,
        lighthouseDamage: 50,
        goldCost: 5,
        cdTimeMs: 300,
    },{
        id: UNIT.BIGEYE,
        maxSpeed: 1.5,
        accel: 0.3,
        angSpeed: 1,
        maxHp: 125,
        armor: 1,
        sightRange: 120,
        radius: 15,
        collides: true,
        canFall: true,
        defaultAiState: AISTATE.PROCEED,
        lighthouseDamage: 100,
        goldCost: 10,
        cdTimeMs: 300,
    },{
        id: UNIT.TANK,
        maxSpeed: 0.8,
        accel: 0.1,
        angSpeed: 1,
        maxHp: 150,
        armor: 2,
        sightRange: 120,
        radius: 20,
        collides: true,
        canFall: true,
        defaultAiState: AISTATE.PROCEED,
        lighthouseDamage: 150,
        goldCost: 25,
        cdTimeMs: 1500,
    }
];

export const unitSprites = makeFromDefaults("unit sprite", unitSpriteData,
                                            unitSpriteDefaults, unitSpriteRequired);

for (const sprite of Object.values(unitSprites)) {
    if (!('anims' in sprite)) {
        sprite.anims = {};
    }
    // add all the missing anims
    for (const animName of Object.values(ANIM)) {
        if (!(animName in sprite.anims)) {
            sprite.anims[animName] = {};
        }
        // add all the missing anim properties
        const anim = sprite.anims[animName];
        for (const [key, defaultVal] of Object.entries(unitAnimDefaults)) {
            if (!(key in anim)) {
                anim[key] = defaultVal;
            }
        }
    }
}

export const weapons = makeFromDefaults("weapon", weaponData, weaponDefaults, weaponRequired);
export const units = makeFromDefaults("unit", unitData, unitDefaults, unitRequired);

export function getUnitWeapon(unit)
{
    return weapons[unit.id];
}

export const hotKeys = {
    [0]: {
        lanes: {
            '1': 0,
            '2': 1,
            '3': 2,
        },
        units: {
            'q': units[UNIT.CHOGORINGU],
            'w': units[UNIT.BIGEYE],
            'e': units[UNIT.TANK],
        },
    },
    [1]: {
        lanes: {
            '8': 0,
            '9': 1,
            '0': 2,
        },
        units: {
            'i': units[UNIT.CHOGORINGU],
            'o': units[UNIT.BIGEYE],
            'p': units[UNIT.TANK],
        },
    }
};

/* App stuff */
export const SCREEN = Object.freeze({
    TITLE: 0,
    GAME: 1,
    GAMEOVER: 2,
    PAUSE: 3,
});
