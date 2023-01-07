import * as Utils from "./util.js";
import { debug, SCREEN } from "./data.js";
import { init as resetGame } from "./game.js";
import { PLAYER_CONTROLLER, makeGameConfig } from "./state.js";
import * as Music from "./music.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);

export let state = null;

const elemData = [
    {
    // title
        id: 'titleMenu',
        screen: SCREEN.TITLE,
    },{
        id: 'checkboxEnableDebug',
        screen: SCREEN.TITLE,
    },{
        id: 'checkboxEnableMusic',
        screen: SCREEN.TITLE,
        fn: updateMusic,
    },{
        id: 'checkboxEnableSfx',
        screen: SCREEN.TITLE,
        fn: updateSfx,
    },{
        id: 'buttonStartPvE',
        fn: startGamePvE,
        screen: SCREEN.TITLE,
    },{
        id: 'buttonStartPvPLocal',
        fn: startGamePvP,
        screen: SCREEN.TITLE,
    },{
    // pause
        id: 'pauseMenu',
        screen: SCREEN.PAUSE,
    },{
        id: 'buttonContinue',
        fn: unpause,
        screen: SCREEN.PAUSE,
    },{
    // game over
        id: 'gameOverMenu',
        screen: SCREEN.GAMEOVER,
    },{
        id: 'gameOverText',
        screen: SCREEN.GAMEOVER,
    },{
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
        musicEnabled: false,
        sfxEnabled: true,
    };
    for (const screenName of Object.values(SCREEN)) {
        screenElems[screenName] = [];
    }
    for (const data of elemData) {
        const { id, screen } = data;
        const elem = document.getElementById(id);
        if (elem.nodeName == 'INPUT')
            switch (elem.type) {
                case 'button':
                case 'checkbox':
                    elem.onclick = data.fn;
                    break;
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
    const enable = elem.checked;
    debug.drawUI = enable;
    debug.enableControls = enable;
}

function updateMusic()
{
    const elem = elemById['checkboxEnableMusic'];
    const enable = elem.checked;
    if (enable) {
        Music.start();
        state.musicEnabled = true;
    } else {
        Music.stop();
        state.musicEnabled = false;
    }
}

function updateSfx()
{
    const elem = elemById['checkboxEnableSfx'];
    const enable = elem.checked;
    if (enable) {
        state.sfxEnabled = true;
    } else {
        state.sfxEnabled = false;
    }
}

function startGame()
{
    updateDebug();
    changeScreen(SCREEN.GAME);
    Music.stop();
    updateMusic();
}

function startGamePvP()
{
    resetGame(makeGameConfig("Player 0", PLAYER_CONTROLLER.LOCAL_HUMAN, "Player 1", PLAYER_CONTROLLER.LOCAL_HUMAN));
    startGame();
}

function startGamePvE()
{
    resetGame(makeGameConfig("Player 0", PLAYER_CONTROLLER.LOCAL_HUMAN, "Bot 1", PLAYER_CONTROLLER.BOT));
    startGame();
}

function startGameEvE()
{
    resetGame(makeGameConfig("Bot 0", PLAYER_CONTROLLER.BOT, "Bot 1", PLAYER_CONTROLLER.BOT));
    startGame();
}

export function gameOver(winnerName, color)
{
    const elem = elemById['gameOverText'];
    elem.innerHTML = `${winnerName} won!`;
    elem.style.color = color;

    debug.drawUI = false;
    debug.enableControls = false;
    changeScreen(SCREEN.GAMEOVER);
}

function backToTitle()
{
    changeScreen(SCREEN.TITLE);
    updateMusic();
}

export function pause()
{
    changeScreen(SCREEN.PAUSE);
}

function unpause()
{
    changeScreen(SCREEN.GAME);
}
