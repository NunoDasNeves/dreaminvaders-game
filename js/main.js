import * as Game from "./game.js";

window.onload = start;

const frameTime = 1000 / 60;

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
    if (timeSinceLastUpdate > frameTime * 3) {
        timeSinceLastUpdate = frameTime;
    }

    while (timeSinceLastUpdate >= frameTime) {
        timeSinceLastUpdate -= frameTime;
        ticks++;
        Game.update(timeElapsed, ticks * frameTime, frameTime);
    }
    Game.render();
}

function initEvents()
{
    document.addEventListener('mousemove', function (event) {
        Game.updateMousePos(event);
    });

    document.addEventListener('mousedown', function (event) {
        Game.updateMousePos(event);
        Game.updateMouseClick(event.button, true);
    });

    document.addEventListener('mouseup', function (event) {
        Game.updateMousePos(event);
        Game.updateMouseClick(event.button, false);
    });

    document.addEventListener('wheel', function (event) {
        // TODO this is just a random scaling value, it might not work everywhere
        Game.updateMouseWheel(event.deltaY * 0.001);
    });

    document.addEventListener('keydown', function (event) {
        Game.updateKey(event.key, true);
    });

    // Key up event
    document.addEventListener('keyup', function (event) {
        Game.updateKey(event.key, false);
    });
}

function start()
{
    Game.initGame();
    initEvents();

    window.requestAnimationFrame(gameLoop);
}