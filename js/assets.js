import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

export const assets = {};

const spriteData = {
    lighthouse: {
        filename: 'lighthouse.png',
        width: 128,
        height: 256,
        centerOffset: vec(0, 74)
    },
    chogoringu: {
        filename: 'unit.png',
        width: 16,
        height: 24,
        centerOffset: vec(0, 3),
    },
};

export function init()
{
    for (const [name, data] of Object.entries(spriteData)) {
        const { filename, width, height, centerOffset } = data;
        const img = new Image();
        assets[name] = { img, loaded: false, width, height, centerOffset } ;
        const asset = assets[name];
        img.onload = function() {
            asset.loaded = true;
            console.assert(asset.width == img.width);
            console.assert(asset.height == img.height);
        };
        img.src = `../assets/${filename}`;
    }
}