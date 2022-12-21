import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

export const assets = {
    images: {},
};

const imageData = {
    lighthouse: {
        filename: 'lighthouse.png',
        centerOffset: vec(0, 74)
    },
    chogoringu: {
        filename: 'unit.png',
        centerOffset: vec(),
    },
};

export const sprites = {
    chogoringu: {
        // where to get the spritesheet from
        imgName: "chogoringu",
        imgAsset: null,
        width: 16,
        height: 24,
        centerOffset: vec(0,3),
        idle: {
            row: 0,
            col: 0,
            frames: 1,
        },
        walk: {
            // start at this row and col in the spritesheet
            row: 0,
            col: 0,
            // how to draw it
            frames: 4,
        },
        attack: {
            row: 0,
            col: 0,
            frames: 1,
        },
    }
};

export function init()
{
    for (const [name, data] of Object.entries(imageData)) {
        const { filename, centerOffset } = data;
        const img = new Image();
        assets.images[name] = { img, loaded: false, width: 0, height: 0, centerOffset } ;
        const imageAsset = assets.images[name];
        img.onload = function() {
            imageAsset.loaded = true;
            imageAsset.width = img.width;
            imageAsset.height = img.height;
            for (const sprite of Object.values(sprites)) {
                if (sprite.imgName == name) {
                    sprite.imgAsset = imageAsset;
                }
            }
        };
        img.src = `../assets/${filename}`;
    }
}