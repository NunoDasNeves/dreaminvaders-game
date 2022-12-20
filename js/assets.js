
export const assets = {}

export function init()
{
    const img = new Image();
    assets['lighthouse'] = { img, loaded: false } ;
    const asset = assets['lighthouse'];
    img.onload = function() {
        asset.loaded = true;
        asset.width = img.width;
        asset.height = img.height;
    };
    img.src = "../assets/lighthouse.png";
}