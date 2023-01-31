import { assets } from "./assets.js";
import * as CSV from "./csv.js";
import * as Utils from "./util.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

function getDataPath(filename)
{
    return `data/${filename}`;
}

async function getDataFile(filename)
{
    const path = getDataPath(filename);
    const response = await fetch(path);
    const text = await response.text();
    return text;
}

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
    drawSoul: false,
    clickedPoint: vec(),
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
            islandRadius: 200,
            lighthouseRadius: 50,
            // where to put center of lighthouse
            lighthouseOffsetX: -50,
            lighthouseOffsetY: -25,
            // where to put the light
            lightHouseLightOffsetY: -148,
            neutralColor: "#dfdfdf",
            playerColors: [ "#ff9933", "#3399ff" ],
            hpBarTimeMs: 2000,
            hitFadeTimeMs: 300,
            deathTimeMs: 1000,
            fallTimeMs: 500,
            startingGold: 10,
            startingGoldPerSec: 1,
            dreamerGoldPerSec: 0.5,
            soulsTextColor: "#86f",
            soulMaxVel: 5,
            soulMinAccel: 0.03,
            soulMaxAccel: 0.5,
            soulCollectionRadius: 20,
            soulMaxAccelRadius: 200,
            soulMinAccelRadius: 1500,
            soulStagingOffset: vec(200, 300), // invert X for player[1], invert Y for souls going down instead of up
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
    IDLE: 0,
    PROCEED: 1,
    CHASE: 2,
    ATTACK: 3,
});
export const ATKSTATE = Object.freeze({
    AIM: 0,
    SWING: 1,
    RECOVER: 2,
});
export const HITSTATE = Object.freeze({
    SPAWN: 0,
    ALIVE: 1,
    DEAD: 2,
});

/* Unit data */

export const ANIM = Object.freeze({
    DO_NOTHING: 0,
    IDLE: 1,
    WALK: 2,
    ATK: 3,
    DIE: 4,
    FALL: 5,
});
export const UNIT = Object.freeze({
    INVALID: 0,
    // special base/lighthouse unit
    BASE: 1,
    // normal units
    CHOGORINGU: 2,
    BIGEYE: 3,
    TANK: 4,
    // buildings
    TOWER: 5,
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
        rows: 3, // not including flipped/recolored frames; used to get flip offset
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
            [ANIM.ATK]: {
                row: 2,
                col: 0,
                frames: 5,
                frameDur: 140,
                // specific to ANIM.ATK:
                swingTime: 140, // time swing starts
                hitTime: 420, // time hit registers
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
            [ANIM.ATK]: {
                row: 1,
                frames: 7,
                frameDur: 150,
                swingTime: 300,
                hitTime: 700,
            },
        },
    },{
        id: UNIT.TANK,
        assetName: "tank",
        width: 72,
        height: 48,
        centerOffset: vec(0,8),
        rows: 3,
        playerColors: true,
        anims: {
            [ANIM.WALK]: {
                row: 1,
                frames: 6,
                frameDur: 200,
            },
            [ANIM.ATK]: {
                row: 2,
                frames: 5,
                frameDur: 300,
                swingTime: 150,
                hitTime: 300,
            },
        },
    },{
        id: UNIT.TOWER,
        assetName: "tower",
        width: 32,
        height: 32,
        centerOffset: vec(0,8),
        rows: 1,
        playerColors: true,
        anims: {
            [ANIM.IDLE]: {
                row: 1,
                frames: 3,
                frameDur: 200,
            },
            [ANIM.ATK]: {
                row: 1,
                frames: 3,
                frameDur: 200,
                swingTime: 0,
                hitTime: 100,
            },
        }
    },
];

const unitRequired = ['id'];
const unitDefaults = Object.freeze({
    topSpeed: 0,
    accel: 0,
    hp: 1,
    armor: 0,
    sightRange: 0,
    radius: 10,
    collides: true,
    canFall: true,
    defaultAiState: AISTATE.DO_NOTHING,
    damageToBase: 0,
    cost: Infinity,
    cdTimeMs: Infinity,
    spawnTimeMs: 0,
    needsUnlock: false,
    unlockCost: 0,
    // range starts at edge of unit radius, so the weapon 'radius' is unit.radius + weapon.range
    range: 0,
    // damage to HP, reduced by effective armor (after armorPen)
    damage: 0,
    // flat armor reduction, before damage is applied
    armorPen: 0,
    // can't miss twice in a row, so it's less really
    missChance: 1,
    sfxName: 'dummy',
});

const unitData = [
    {
        id: UNIT.BASE,
        hp: 1000,
        radius: params.lighthouseRadius,
        collides: false,
        canFall: false,
    },{
        id: UNIT.CHOGORINGU,
        topSpeed: 1.5,
        accel: 0.4,
        hp: 35,
        sightRange: 60,
        radius: 8,
        defaultAiState: AISTATE.PROCEED,
        damageToBase: 50,
        cost: 5,
        cdTimeMs: 300,
        spawnTimeMs: 1000,
        // weapon
        range: 10,
        damage: 6,
        missChance: 0.15,
        sfxName: 'chogoringuAtk',
    },{
        id: UNIT.BIGEYE,
        topSpeed: 1.5,
        accel: 0.3,
        hp: 80,
        armor: 1,
        sightRange: 120,
        radius: 15,
        defaultAiState: AISTATE.PROCEED,
        damageToBase: 100,
        cost: 10,
        cdTimeMs: 300,
        spawnTimeMs: 3000,
        needsUnlock: true,
        unlockCost: 5,
        // weapon
        range: 90,
        damage: 9,
        aoeRadius: 20, // radius around the hit point
        aoeMissRadius: 30, // how far away from target we might hit
        aoeAccuracy: 0.25, // higher accuracy = less chance of hitting edge of miss radius
        sfxName: 'bigeyeAtk',
    },{
        id: UNIT.TANK,
        topSpeed: 0.8,
        accel: 0.1,
        hp: 100,
        armor: 1,
        sightRange: 120,
        radius: 20,
        defaultAiState: AISTATE.PROCEED,
        damageToBase: 150,
        cost: 20,
        cdTimeMs: 1500,
        spawnTimeMs: 6000,
        needsUnlock: true,
        unlockCost: 10,
        // weapon
        range: 100,
        damage: 25,
        armorPen: 2,
        missChance: 0.1,
        aoeRadius: 10, // looks like AOE but is actually single target
        sfxName: 'tankAtk',
    },{
        id: UNIT.TOWER,
        topSpeed: 0,
        accel: 0,
        hp: 1,
        radius: 1,
        defaultAiState: AISTATE.IDLE,
        collides: false,
        canFall: false,
        sightRange: 650,
        // weapon
        // TODO use these
        atkMs: 1000, // total time taken to attack - should agree with anim
        swingTime: 0, // 'swing' start time
        hitTime: 100, // hit time
        //
        range: 650,
        damage: 5,
        missChance: 0.1,
        aoeRadius: 10, // looks like AOE but is actually single target
        aoeMissRadius: 30,
        sfxName: 'staticDatk',
    },
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
            sprite.anims[animName] = {
                id: animName,
            };
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

export function getUnitAnim(unit, animName)
{
    return unitSprites[unit.id].anims[animName];
}

export const units = makeFromDefaults("unit", unitData, unitDefaults, unitRequired);

async function loadUnitData()
{
    const unitCSV = await getDataFile('unit.csv');
    const { success, array, error } = CSV.parse(unitCSV);
    if (!success) {
        console.error(error);
    } else {
        console.log(array);
    }
}

export function getUnitWeapon(unit)
{
    return unit;
}

export const UPGRADE = Object.freeze({
    ECO: 0,
    ATK: 1,
    DEF: 2,
    TOWER: 3,
});

export const upgrades = Object.freeze({
    [UPGRADE.TOWER]: {
        id: UPGRADE.TOWER,
        soulsCost: [10],
        sfxName: 'upgradeTower',
    },
    [UPGRADE.ECO]: {
        id: UPGRADE.ECO,
        soulsCost: [10, 10, 10],
        goldPerSecBonus: [0.25,0.75,1.5],
        sfxName: 'upgradeEco',
    },
    [UPGRADE.ATK]: {
        id: UPGRADE.ATK,
        soulsCost: [0], // UNUSED
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
        soulsCost: [0], // UNUSED
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
            'a': UPGRADE.TOWER,
            's': UPGRADE.ECO,
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
            'k': UPGRADE.TOWER,
            'l': UPGRADE.ECO,
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

export function init()
{
    loadUnitData();

    for (const sprite of Object.values(unitSprites)) {
        console.assert(sprite.assetName in assets.images);
        sprite.imgAsset = assets.images[sprite.assetName];
    }
    for (const sprite of Object.values(envSprites)) {
        console.assert(sprite.assetName in assets.images);
        sprite.imgAsset = assets.images[sprite.assetName];
    }
}
