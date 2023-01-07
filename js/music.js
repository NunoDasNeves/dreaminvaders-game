import * as Utils from "./util.js";
import * as App from './app.js';
import { SCREEN } from './data.js';
import { assets } from "./assets.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

const music = {};

let audioContext = null;
let currSong = null;

const fadeInSec = 0.01;
const fadeOutSec = 0.01;

function fadeInSong(song, fromStart = true)
{
    if (!song.asset.loaded) {
        console.warn("Can't play song because not yet loaded");
        return null;
    }
    if (fromStart) {
        song.asset.sound.currentTime = 0;
    }
    song.asset.sound.play();
    song.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    song.gainNode.gain.linearRampToValueAtTime(song.volume, audioContext.currentTime + fadeInSec);
    return song;
}

function fadeOutSong(song, suspendCtx=false)
{
    if (!song.asset.loaded) {
        return;
    }
    song.gainNode.gain.setValueAtTime(song.volume, audioContext.currentTime);
    song.gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + fadeOutSec);
    setTimeout(() => {
        song.asset.sound.pause();
        if (suspendCtx) {
            audioContext.suspend();
        }
    }, fadeOutSec * 1000);
}

export function start()
{
    if (App.state.screen == SCREEN.TITLE) {
        currSong = fadeInSong(music.menu);
    } else if (App.state.screen == SCREEN.GAME) {
        currSong = fadeInSong(music.game);
    }
    audioContext.resume();
}

export function stop()
{
    if (currSong != null) {
        fadeOutSong(currSong);
    }
    currSong = null;
}

export function init()
{
    audioContext = new AudioContext();

    for (const [key, asset] of Object.entries(assets.music)) {
        const audioNode = audioContext.createMediaElementSource(asset.sound);
        audioNode.loop = asset.loop;
        const gainNode = audioContext.createGain();
        audioNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
        music[key] = {
            name: key,
            asset,
            audioNode,
            gainNode,
            volume: 1,
        };
    }
}
