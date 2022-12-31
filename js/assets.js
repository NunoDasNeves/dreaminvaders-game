import * as Utils from "./util.js";
import { unitSprites } from "./data.js";
import { music } from "./music.js";
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

// these images are non-sprite images... see sprites in data for that.
const imageData = {
    lighthouse: {
        filename: 'lighthouse.png',
        width: 128,
        height: 256,
        centerOffset: vec(0, 74)
    },
};

function loadAudioAsset(filename, loop = false)
{
    const sound = new Audio();

    const audioAsset = { sound, loaded: false } ;

    sound.addEventListener("canplaythrough", function() {
        audioAsset.loaded = true;
    });

    sound.loop = loop;
    sound.src = getAssetPath(filename);
    sound.load();

    return audioAsset;
}

// width and height are not really needed; the real width/height will be used after loading
function loadImageAsset(filename, width=50, height=50, centerOffset=vec())
{
    const img = new Image();

    const imageAsset = { img, loaded: false, width, height, centerOffset: vecClone(centerOffset) } ;

    img.onload = function() {
        imageAsset.loaded = true;
        // update with real width and height; the others are just an estimate/placeholder...idk
        imageAsset.width = img.width;
        imageAsset.height = img.height;
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
    for (const [name, sprite] of Object.entries(unitSprites)) {
        const { filename, width, height, centerOffset } = sprite;
        // probably not super needed but in case any sprites reuse the same image, don't load it twice
        if (!assets.images[name]) {
            const asset = loadImageAsset(filename, width, height, centerOffset);
            assets.images[name] = asset;
        }
        sprite.imgAsset = assets.images[name];
    }
    for (const [name, data] of Object.entries(music)) {
        const { filename } = data;
        const asset = loadAudioAsset(filename, data.loop ? true : false);
        assets.music[name] = asset;
        data.asset = asset;
    }
}
