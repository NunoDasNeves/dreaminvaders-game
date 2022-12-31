import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import * as App from './app.js';
import { SCREEN } from './data.js';

let context = null;
let currMusic = null;

const musicRequired = [ 'id', 'filename' ];
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
        filename: 'menu.mp3',
        loop: true,
    },
];

export const music = makeFromDefaults("music", musicData, musicDefaults, musicRequired);

function play(id)
{
    const m = music[id];
    if (m.asset.loaded) {
        const node = m.audioNode;
        node.connect(context.destination);
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
    context.resume();
}

export function stop()
{
    //pause(currMusic.id);
    context.suspend();
    currMusic = null;
}

export function init()
{
    context = new AudioContext();

    for (const m of Object.values(music)) {
        m.audioNode = context.createMediaElementSource(m.asset.sound);
    }
}