import * as Utils from "./util.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

// all the images (and other assets later) will live here
export const assets = {
    images: {},
    music: {},
    sfx: {}, // TODO
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

// these images are non-sprite images... see sprites in data for that.
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
        filename: "tank.png",
        width: 64,
        height: 64,
    },
};

const sfxData = {
    dummy: {
        filename: 'dummy.mp3',
    },
    victory: {
        filename: 'victory.mp3',
    },
    defeat: {
        filename: 'defeat.mp3',
    },
    spawn: {
        filename: 'dummy.mp3',
    },
    death: {
        filename: 'death.mp3',
    },
    chogoringuatk: {
        filename: 'dummy.mp3',
    },
    bigeyeatk: {
        filename: 'bigeyelaser.mp3',
    },
    tankatk: {
        filename: 'dummy.mp3',
    },
    staticDatk: {
        filename: 'dummy.mp3',
    },
    unlockUnit: {
        filename: 'dummy.mp3',
    },
    upgradeEco: {
        filename: 'dummy.mp3',
    },
    upgradeAtk: {
        filename: 'dummy.mp3',
    },
    upgradeDef: {
        filename: 'dummy.mp3',
    }
};

const musicData = {
    menu: {
        filename: 'menu.mp3',
        loop: true,
    },
    game: {
        filename: 'game.mp3',
        loop: true,
    },
};

function loadAudioAsset(path, loop = false)
{
    const sound = new Audio();

    const audioAsset = { sound, loaded: false } ;

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

export function init()
{
    for (const [name, data] of Object.entries(imageData)) {
        const { filename, width, height, centerOffset } = data;
        const asset = loadImageAsset(filename, width, height, centerOffset);
        assets.images[name] = asset;
    }
    for (const [name, data] of Object.entries(musicData)) {
        const { filename, loop } = data;
        const asset = loadAudioAsset(getMusicPath(filename), loop);
        assets.music[name] = asset;
    }
    for (const [name, data] of Object.entries(sfxData)) {
        const { filename } = data;
        const asset = loadAudioAsset(getSfxPath(filename), false);
        assets.sfx[name] = asset;
    }
}
