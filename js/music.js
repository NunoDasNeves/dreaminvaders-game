import * as Utils from "./util.js";
import * as App from './app.js';
import { SCREEN } from './data.js';
import { assets } from "./assets.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

let audioContext = null;
let currMusic = null;

const musicRequired = [ 'id', 'assetName' ];
const musicDefaults = Object.freeze({
    loop: false,
    asset: null,
    audioNode: null,
});

const MUSIC = Object.freeze({
    MENU: 0,
});

const musicData = [
    {
        id: MUSIC.MENU,
        assetName: "menu",
        loop: true,
    },
];

export const music = makeFromDefaults("music", musicData, musicDefaults, musicRequired);

function play(id)
{
    const m = music[id];
    if (m.asset.loaded) {
        const node = m.audioNode;
        node.connect(audioContext.destination);
        node.loop = m.loop;
        m.asset.sound.play();
        return m;
    } else {
        console.warn("Can't play music because not yet loaded");
        return null;
    }
}

function pause(id)
{
    const m = music[id];
    if (m.asset.loaded) {
        m.audioNode.disconnect();
        m.asset.sound.pause();
    }
}

export function start()
{
    if (App.state.screen == SCREEN.TITLE) {
        if (currMusic == null || currMusic.id != MUSIC.MENU) {
            currMusic = play(MUSIC.MENU);
        }
    }
    audioContext.resume();
}

export function stop()
{
    //pause(currMusic.id);
    audioContext.suspend();
    currMusic = null;
}

export function init()
{
    audioContext = new AudioContext();

    for (const song of Object.values(music)) {
        console.assert(song.assetName in assets.music);
        song.asset = assets.music[song.assetName];
        song.audioNode = audioContext.createMediaElementSource(song.asset.sound);
    }
}