import * as Utils from "./util.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

// all the images (and other assets later) will live here
export const assets = {
    images: {},
    music: {},
    sfx: {},
};

function getAssetPath(filename)
{
    return `assets/${filename}`;
}

function getMusicPath(filename)
{
    return getAssetPath(`music/${filename}`);
}

function getSfxPath(filename)
{
    return getAssetPath(`sfx/${filename}`);
}

const imageData = {
    island: {
        filename: 'island.png',
        width: 512,
        height: 1024,
    },
    lighthouse: {
        filename: 'lighthouse.png',
        width: 128,
        height: 256,
    },
    chogoringu: {
        filename: 'chogoringu.png',
        width: 16,
        height: 24,
    },
    bigeye: {
        filename: "bigeye.png",
        width: 32,
        height: 32,
    },
    tank: {
        filename: "slimetank.png",
        width: 64,
        height: 64,
    },
    tower: {
        filename: "tower.png",
        width: 32,
        height: 32,
    },
    dreamer: {
        filename: "dreamer.png",
        width: 48,
        height: 48,
    },
    lhDreamer0: {
        filename: "lh_dreamer_0.png",
        width: 160,
        height: 256,
    },
    lhDreamer1: {
        filename: "lh_dreamer_1.png",
        width: 160,
        height: 256,
    },
    lhDreamer2: {
        filename: "lh_dreamer_2.png",
        width: 160,
        height: 256,
    },
    lhDreamer3: {
        filename: "lh_dreamer_3.png",
        width: 160,
        height: 256,
    },
    scream: {
        filename: "scream.png",
        width: 16,
        height: 16,
    },
    soul: {
        filename: "soul.png",
        width: 16,
        height: 16,
    },
    incomeUpgrade: {
        filename: "income_upgrade.png",
        width: 64,
        height: 64,
    },
    defenseUpgrade: {
        filename: "defense_upgrade.png",
        width: 64,
        height: 64,
    },
    goldIcon: {
        filename: "scream_icon.png",
        width: 24,
        height: 24,
    },
    soulIcon: {
        filename: "soul_icon.png",
        width: 24,
        height: 24,
    },
};

const sfxDefaultVolume = 0.7; // 0-1
const musicDefaultVolume = 1; // 0-1

const sfxData = {
    dummy: {
        filename: 'dummy.mp3',
    },
    victory: {
        filename: 'victory.mp3',
        volume: 1,
    },
    defeat: {
        filename: 'defeat.mp3',
        volume: 1,
    },
    spawn: {
        filename: 'scream.mp3',
    },
    death: {
        filename: 'death.mp3',
        volume: 1
    },
    chogoringuAtk: {
        filename: 'chogoringuAtk.mp3',
        volume: 0.07
    },
    bigeyeAtk: {
        filename: 'bigeyelaser.mp3',
    },
    tankAtk: {
        filename: 'Cannon Sound V2.mp3',
        volume: 0.3
    },
    towerAtk: {
        filename: 'Lighthouse Laser.mp3',
        volume: 0.2
    },
    unlockUnit: {
        filename: 'upgrade.mp3',
        volume: 0.35
    },
    upgradeEco: {
        filename: 'upgrade.mp3',
        volume: 0.35
    },
    upgradeAtk: {
        filename: 'upgrade.mp3',
        volume: 0.35
    },
    upgradeDef: {
        filename: 'upgrade.mp3',
        volume: 0.35
    },
    upgradeTower: {
        filename: 'upgrade.mp3',
        volume: 0.35
    },
    lighthouseHit: {
        filename: 'Lighthouse Hit.mp3',
    },
};

const musicData = {
    menu: {
        filename: 'menu.mp3',
        volume: 0.7,
        loop: true,
    },
    game: {
        filename: 'ACOM9GD.mp3',
        volume: 0.5,
        loop: true,
    },
};

function loadAudioAsset(path, loop = false, volume = 1)
{
    const sound = new Audio();

    const audioAsset = { sound, loaded: false, volume } ;

    sound.addEventListener("canplaythrough", function() {
        audioAsset.loaded = true;
    });

    sound.loop = loop;
    sound.src = path;
    sound.load();

    return audioAsset;
}

// width and height are not really needed; the real width/height will be used after loading
function loadImageAsset(filename, width=50, height=50, centerOffset=vec())
{
    const img = new Image();

    const imageAsset = {
        img,
        loaded: false,
        width,
        height,
        centerOffset: vecClone(centerOffset),
        scratchCanvas: new OffscreenCanvas(width, height),
    };
    imageAsset.scratchCtx = imageAsset.scratchCanvas.getContext("2d");

    img.onload = function() {
        imageAsset.loaded = true;
        // update with real width and height; the others are just an estimate/placeholder...idk
        imageAsset.width = img.width;
        imageAsset.height = img.height;
        imageAsset.scratchCanvas.width = img.width;
        imageAsset.scratchCanvas.height = img.height;
    };

    // this actually makes it start loading the image
    img.src = getAssetPath(filename);

    return imageAsset;
}

export async function init()
{
    for (const [name, data] of Object.entries(imageData)) {
        const { filename, width, height, centerOffset } = data;
        const asset = loadImageAsset(filename, width, height, centerOffset);
        assets.images[name] = asset;
    }
    for (const [name, data] of Object.entries(musicData)) {
        const { filename, loop } = data;
        const volume = 'volume' in data ? data.volume : musicDefaultVolume;
        const asset = loadAudioAsset(getMusicPath(filename), loop, volume);
        assets.music[name] = asset;
    }
    for (const [name, data] of Object.entries(sfxData)) {
        const { filename } = data;
        const volume = 'volume' in data ? data.volume : sfxDefaultVolume;
        const asset = loadAudioAsset(getSfxPath(filename), false, volume);
        assets.sfx[name] = asset;
    }
}
