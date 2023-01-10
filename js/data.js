import { assets } from "./assets.js";
import * as Utils from "./util.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

/*
 * Static data
 */

export const debug = {
    skipAppMenu: false, // launch straight into a game
    enableControls: false,
    paused: false,
    frameAdvance: false,
    // debug drawing below here
    drawUI: false, // all the debug UI below is dependent on this
    drawAiState: false,
    drawCollision: false,
    drawSightRange: false,
    drawWeaponRange: false,
    drawAngle: false,
    drawVel: false,
    drawAccel: false,
    drawSwing: false,
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
            backgroundGradientTop: "#160f12",
            backgroundGradientBottom: "#0d0e1b",
            baseFadeColor: "#101010",
            laneColor: "#888",
            laneHoveredColor: "#aaa",
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
            staticDCdMs: 1000,
            staticDRange: 650,
            staticDDamage: 8,
            staticDRadius: 10,
        }
        obj.laneDistFromBase = obj.islandRadius - 50;
        obj.spawnPlatRadius = obj.laneWidth * 0.75;
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
    STATICD_BEAM: 4,
    TEXT: 5,
});

export const envSprites = {
    island: {
        assetName: "island",
        width: 512,
        height: 768,
        rows: 1,
        centerOffset: vec(-256,-256),
        imgAsset: null,
    },
};

const unitSpriteRequired = ['id', 'assetName', 'width', 'height'];
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
        assetName: "lighthouse",
        width: 128,
        height: 256,
        rows: 1,
        centerOffset: vec(0,74),
    },
    {
        id: UNIT.CHOGORINGU,
        assetName: "chogoringu",
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
        assetName: "bigeye",
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
        assetName: "tank",
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
    sfxName: 'dummy',
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
        sfxName: 'chogoringuAtk',
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
        sfxName: 'bigeyeAtk',
    },{
        id: UNIT.TANK,
        range: 100,
        aimMs: 400,
        swingMs: 200,
        recoverMs: 800,
        damage: 34,
        armorPen: 2,
        missChance: 0.1,
        sfxName: 'tankAtk',
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
    needsUnlock: false,
    unlockCost: 0,
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
        defaultAiState: AISTATE.PROCEED,
        lighthouseDamage: 100,
        goldCost: 10,
        cdTimeMs: 300,
        needsUnlock: true,
        unlockCost: 15,
    },{
        id: UNIT.TANK,
        maxSpeed: 0.8,
        accel: 0.1,
        angSpeed: 1,
        maxHp: 150,
        armor: 2,
        sightRange: 120,
        radius: 20,
        defaultAiState: AISTATE.PROCEED,
        lighthouseDamage: 150,
        goldCost: 25,
        cdTimeMs: 1500,
        needsUnlock: true,
        unlockCost: 30,
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

export const UPGRADE = Object.freeze({
    ECO: 0,
    ATK: 1,
    DEF: 2,
});

export const upgrades = Object.freeze({
    [UPGRADE.ECO]: {
        id: UPGRADE.ECO,
        goldCost: [15, 20, 30],
        goldPerSecBonus: [0.5,1,1.5],
        sfxName: 'upgradeEco',
    },
    [UPGRADE.ATK]: {
        id: UPGRADE.ATK,
        goldCost: [15, 25],
        damageBonus: {
            [UNIT.CHOGORINGU]: [1,3],
            [UNIT.BIGEYE]: [2,4],
            [UNIT.TANK]: [2,5],
        },
        sfxName: 'upgradeAtk',
    },
    [UPGRADE.DEF]: {
        id: UPGRADE.DEF,
        goldCost: [15, 25],
        armorBonus: {
            [UNIT.CHOGORINGU]: [2,4],
            [UNIT.BIGEYE]: [1,3],
            [UNIT.TANK]: [2,4],
        },
        sfxName: 'upgradeDef',
    },
});

export const hotKeys = {
    [0]: {
        lanes: {
            '1': 0,
            '2': 1,
            '3': 2,
        },
        units: {
            'q': UNIT.CHOGORINGU,
            'w': UNIT.BIGEYE,
            'e': UNIT.TANK,
        },
        upgrades: {
            'a': UPGRADE.ECO,
            's': UPGRADE.ATK,
            'd': UPGRADE.DEF,
        }
    },
    [1]: {
        lanes: {
            '8': 0,
            '9': 1,
            '0': 2,
        },
        units: {
            'i': UNIT.CHOGORINGU,
            'o': UNIT.BIGEYE,
            'p': UNIT.TANK,
        },
        upgrades: {
            'k': UPGRADE.ECO,
            'l': UPGRADE.ATK,
            ';': UPGRADE.DEF,
        }
    }
};

/* App stuff */
export const SCREEN = Object.freeze({
    TITLE: 0,
    GAME: 1,
    GAMEOVER: 2,
    PAUSE: 3,
});


export function initSprites()
{
    for (const sprite of Object.values(unitSprites)) {
        console.assert(sprite.assetName in assets.images);
        sprite.imgAsset = assets.images[sprite.assetName];
    }
    for (const sprite of Object.values(envSprites)) {
        console.assert(sprite.assetName in assets.images);
        sprite.imgAsset = assets.images[sprite.assetName];
    }
}
