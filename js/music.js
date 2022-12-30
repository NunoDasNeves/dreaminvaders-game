import * as App from './app.js';
import { SCREEN } from './data.js';
import { assets } from './assets.js';

export function start()
{
    if (App.state.screen == SCREEN.TITLE) {
        assets.music.menu.sound.play();
    }
}

export function stop()
{
    for (const { sound } of Object.values(assets.music)) {
        sound.pause();
    }
}