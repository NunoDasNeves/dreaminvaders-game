import * as App from './app.js';
import * as Game from "./game.js";
import * as State from "./state.js";
import * as Render from "./render.js";
import * as Assets from "./assets.js";
import * as Music from "./music.js";
import * as UI from "./UI.js";
import * as Data from "./data.js";

window.onload = start;

const frameTimeMs = 1000 / 60;

let timeSinceLastUpdate = 0;
let previousTimeMs = 0;
let ticks = 0;

function gameLoop(timeElapsed)
{
    window.requestAnimationFrame(gameLoop);

    let timeDelta = timeElapsed - previousTimeMs;
    timeSinceLastUpdate += timeDelta;
    previousTimeMs = timeElapsed;

    // if a lot of time has passed, just reset and do a single update
    if (timeSinceLastUpdate > frameTimeMs * 3) {
        timeSinceLastUpdate = frameTimeMs;
    }

    while (timeSinceLastUpdate >= frameTimeMs) {
        timeSinceLastUpdate -= frameTimeMs;
        ticks++;
        Data.debug.numUpdates++;
        Game.update(timeElapsed, ticks * frameTimeMs, frameTimeMs);
    }
    Render.draw(timeElapsed, timeDelta);
}

function initEvents()
{
    document.addEventListener('mousemove', function (event) {
        State.updateMousePos(event, Render.getBoundingClientRect());
    });

    document.addEventListener('mousedown', function (event) {
        State.updateMousePos(event, Render.getBoundingClientRect());
        State.updateMouseClick(event.button, true);
    });

    document.addEventListener('mouseup', function (event) {
        State.updateMousePos(event, Render.getBoundingClientRect());
        State.updateMouseClick(event.button, false);
    });

    document.addEventListener('wheel', function (event) {
        // TODO this is just a random scaling value, it might not work everywhere
        State.updateMouseWheel(event.deltaY * 0.001);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key == 'Tab') {
            event.preventDefault();
        }
        State.updateKey(event.key, true);
    });

    // Key up event
    document.addEventListener('keyup', function (event) {
        State.updateKey(event.key, false);
    });
}

function start()
{
    // Do assets first, other modules depend on assets existing
    Assets.init();
    Data.init();
    Music.init();
    Render.init();
    UI.init();
    initEvents();
    App.init();

    window.requestAnimationFrame(gameLoop);
}
