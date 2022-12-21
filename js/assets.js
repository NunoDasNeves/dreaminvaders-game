import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { sprites } from "./data.js";

export const assets = {
    images: {},
};

const imageData = {
    lighthouse: {
        filename: 'lighthouse.png',
        width: 128,
        height: 256,
        centerOffset: vec(0, 74)
    },
    chogoringu: {
        filename: 'unit.png',
        width: 44, // placeholders...
        height: 44,
        centerOffset: vec(),
    },
};

export function init()
{
    for (const [name, data] of Object.entries(imageData)) {
        const { filename, width, height, centerOffset } = data;
        const img = new Image();

        // create asset, but not loaded yet
        assets.images[name] = { img, loaded: false, width, height, centerOffset } ;
        const imageAsset = assets.images[name];

        // populate sprites that use that asset
        for (const sprite of Object.values(sprites)) {
            if (sprite.imgName == name) {
                sprite.imgAsset = imageAsset;
            }
        }

        img.onload = function() {
            imageAsset.loaded = true;
            // update with real width and height; the others are just an estimate/placeholder...idk
            imageAsset.width = img.width;
            imageAsset.height = img.height;
        };

        // this actually makes it start loading the image
        img.src = `../assets/${filename}`;
    }
}
