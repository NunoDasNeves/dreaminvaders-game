import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);
import { debug, SCREEN } from "./data.js";
import { init as resetGame, update } from "./game.js";
import { PLAYER_CONTROLLER } from "./state.js";

export let state = null;

const elemData = [
    // title
    {
        id: 'titleMenu',
        screen: SCREEN.TITLE,
    },
    {
        id: 'checkboxEnableDebug',
        screen: SCREEN.TITLE,
    },
    {
        id: 'buttonStartPvE',
        fn: startGamePvE,
        screen: SCREEN.TITLE,
    },
    {
        id: 'buttonStartPvPLocal',
        fn: startGamePvP,
        screen: SCREEN.TITLE,
    },
    // pause
    {
        id: 'pauseMenu',
        screen: SCREEN.PAUSE,
    },
    {
        id: 'buttonContinue',
        fn: unpause,
        screen: SCREEN.PAUSE,
    },
    // game over
    {
        id: 'gameOverMenu',
        screen: SCREEN.GAMEOVER,
    },
    {
        id: 'buttonBackToTitle',
        fn: backToTitle,
        screen: SCREEN.GAMEOVER,
    },
];

const screenElems = {};
const elemById = {};

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
    for (const data of elemData) {
        const { id, screen } = data;
        const elem = document.getElementById(id);
        if (elem.nodeName == 'INPUT' && elem.type == 'button') {
            elem.onclick = data.fn;
        }
        // hide em all by default
        elem.hidden = true;
        screenElems[screen].push(elem);
        elemById[id] = elem;
    }

    if (debug.skipAppMenu) {
        updateDebugCheckbox(true);
        startGamePvP();
    } else {
        startGameEvE();
        changeScreen(SCREEN.TITLE);
    }

    const appUIElem = document.getElementById("appUI");
    appUIElem.hidden = false;
}

function updateDebugCheckbox(checked)
{
    const elem = elemById['checkboxEnableDebug'];
    elem.checked = checked;
}

function updateDebug()
{
    const elem = elemById['checkboxEnableDebug'];
    let enable = false;
    if (elem.checked) {
        enable = true;
    }
    debug.drawUI = enable;
    debug.enableControls = enable;
}

function startGame()
{
    updateDebug();
    changeScreen(SCREEN.GAME);
}

function startGamePvP()
{
    resetGame(PLAYER_CONTROLLER.LOCAL_HUMAN, PLAYER_CONTROLLER.LOCAL_HUMAN);
    startGame();
}

function startGamePvE()
{
    resetGame(PLAYER_CONTROLLER.LOCAL_HUMAN, PLAYER_CONTROLLER.BOT);
    startGame();
}

function startGameEvE()
{
    resetGame(PLAYER_CONTROLLER.BOT, PLAYER_CONTROLLER.BOT);
    startGame();
}

export function gameOver(winnerName, color)
{
    debug.drawUI = false;
    debug.enableControls = false;
    changeScreen(SCREEN.GAMEOVER);
}

function backToTitle()
{
    changeScreen(SCREEN.TITLE);
}

export function pause()
{
    changeScreen(SCREEN.PAUSE);
}

function unpause()
{
    changeScreen(SCREEN.GAME);
}