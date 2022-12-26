import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);
import { SCREEN } from "./data.js";
import { init as resetGame } from "./game.js";

export let state = null;

const buttonData = [
    {
        id: 'buttonStart',
        fn: startGame,
        screen: SCREEN.TITLE,
    },
    {
        id: 'buttonContinue',
        fn: unpause,
        screen: SCREEN.PAUSE,
    },
    {
        id: 'buttonBackToTitle',
        fn: backToTitle,
        screen: SCREEN.GAMEOVER,
    },
];

const screenElems = {};

function changeScreen(screen)
{
    const currScreen = state.screen;
    const newScreen = screen;
    for (const elem of screenElems[currScreen]) {
        elem.hidden = true;
    }
    for (const elem of screenElems[newScreen]) {
        elem.hidden = false;
    }

    state.screen = newScreen;
}

export function init()
{
    state = {
        screen: SCREEN.TITLE,
    };
    for (const screenName of Object.values(SCREEN)) {
        screenElems[screenName] = [];
    }
    for (const { id, fn, screen } of buttonData) {
        const elem = document.getElementById(id);
        elem.onclick = fn;
        screenElems[screen].push(elem);
    }
    changeScreen(SCREEN.TITLE);
}

export function startGame()
{
    changeScreen(SCREEN.GAME);
}

export function gameOver(winnerName, color)
{
    changeScreen(SCREEN.GAMEOVER);
}

function backToTitle()
{
    changeScreen(SCREEN.TITLE);
    resetGame();
}

export function pause()
{
    changeScreen(SCREEN.PAUSE);
}

function unpause()
{
    changeScreen(SCREEN.GAME);
}