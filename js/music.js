import * as Utils from "./util.js";
import * as App from './app.js';
import { SCREEN } from './data.js';
import { assets } from "./assets.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

const music = {};

let audioContext = null;
let currSong = null;

function play(song)
{
    if (song.asset.loaded) {
        const node = song.audioNode;
        node.loop = song.asset.loop;
        song.asset.sound.play();
        return song;
    } else {
        console.warn("Can't play song because not yet loaded");
        return null;
    }
}

function pause(song)
{
    if (song.asset.loaded) {
        song.asset.sound.pause();
    }
}

export function start()
{
    if (App.state.screen == SCREEN.TITLE) {
        currSong = play(music.menu);
    } else if (App.state.screen == SCREEN.GAME) {
        currSong = play(music.game);
    }
    audioContext.resume();
}

export function stop()
{
    if (currSong != null) {
        pause(currSong);
    }
    audioContext.suspend();
    currSong = null;
}

export function init()
{
    audioContext = new AudioContext();

    for (const [key, asset] of Object.entries(assets.music)) {
        const audioNode = audioContext.createMediaElementSource(asset.sound);
        audioNode.connect(audioContext.destination);
        music[key] = {
            name: key,
            asset,
            audioNode,
        };
    }
}
