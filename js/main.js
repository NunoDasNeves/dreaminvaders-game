window.onload = start;

let canvas = null;
let context = null;
let state = null;

const frameTime = 1000 / 60;

function vecAdd(v1, v2)
{
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

function vecSub(v1, v2)
{
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

function vecMul(v, f)
{
    return { x: v.x * f, y: v.y * f };
}

function vecLen(v)
{
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecNorm(v)
{
    const len = vecLen(v);
    if ( len < 0.0001 ) {
        console.error("Tried to divide by 0");
        return { x: 0, y: 0 };
    }
    return { x: v.x/len, y: v.y/len }
}

// Convert camera coordinates to world coordinates with scale
function cameraToWorld(x, y) {
    return {x: (x - canvas.width / 2) * state.camera.scale + state.camera.x,
            y: (y - canvas.height / 2) * state.camera.scale + state.camera.y};
}

// Convert world coordinates to camera coordinates with scale
function worldToCamera(x, y) {
    return {x: (x - state.camera.x) / state.camera.scale + canvas.width / 2,
            y: (y - state.camera.y) / state.camera.scale + canvas.height / 2};
}

function drawCircle(worldPos, radius, fillStyle)
{
    let coords = worldToCamera(worldPos.x, worldPos.y);
    context.beginPath();
    context.arc(coords.x, coords.y, radius / state.camera.scale, 0, 2 * Math.PI);
    context.fillStyle = fillStyle;
    context.fill();
}

function drawRectangle(worldPos, width, height, fillStyle, fromCenter=false) {
    let coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledWidth = width / state.camera.scale;
    const scaledHeight = height / state.camera.scale;
    if (fromCenter) {
        coords.x -= scaledWidth / 2;
        coords.y -= scaledHeight / 2;
    }
    context.beginPath();
    context.rect(coords.x, coords.y, scaledWidth, scaledHeight);
    context.fillStyle = fillStyle;
    context.fill();
}

function render()
{
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#3f3f3f";
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawRectangle(state.ppos, 20, 20, "#ff3333", true);
    drawCircle(state.pos, 12, "#00e060");
}

function update(realTimeMs, ticksMs, timeDeltaMs)
{
    state.pos.y = Math.sin(ticksMs/1000) * 4 * timeDeltaMs;
    state.pos.x = Math.cos(ticksMs/1000) * 4 * timeDeltaMs;

    if (state.input.mouseLeft) {
        const toMouse = vecSub(state.input.mousePos, state.ppos);
        if (vecLen(toMouse) > 4) {
            const vel = vecMul(vecNorm(toMouse), 4);
            state.ppos = vecAdd(state.ppos, vel);
        }
    }
}

function initState()
{
    state = {
        pos: { x: 5, y: 6 },
        ppos: { x : -10, y: -10 },
        camera: {
            x: 0,
            y: 0,
            scale: 1, // scale +++ means zoom out
            easeFactor: 0.1
        },
        input: {
            mousePos: { x: 0, y: 0 },
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false,
            keyR: false,
            keySpace: false
        },
    };
}

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
        update(timeElapsed, ticks * frameTime, frameTime);
    }
    render();
}

function updateMousePos(event)
{
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    state.input.mousePos = cameraToWorld(x, y);
}

function initEvents()
{
    document.addEventListener('mousemove', function (event) {
        updateMousePos(event);
    });

    document.addEventListener('mousedown', function (event) {
        updateMousePos(event);
        switch (event.button) {
            case 0:
                state.input.mouseLeft = true;
                break;
            case 1:
                state.input.mouseMiddle = true;
                break;
            case 2:
                state.input.mouseRight = true;
                break;
        }
    });

    document.addEventListener('mouseup', function (event) {
        updateMousePos(event);
        switch (event.button) {
            case 0:
                state.input.mouseLeft = false;
                break;
            case 1:
                state.input.mouseMiddle = false;
                break;
            case 2:
                state.input.mouseRight = false;
                break;
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key == 'r') {
            state.input.keyR = true;
        }
        // spacebar
        if (event.keyCode == 32) {
            state.input.keySpace = true;
        }
    });

    // Key up event
    document.addEventListener('keyup', function (event) {
        if (event.key == 'r') {
            state.input.keyR = false;
        }
        // spacebar
        if (event.keyCode == 32) {
            state.input.keySpace = false;
        }
    });
}

function start()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");

    initState();
    initEvents();

    window.requestAnimationFrame(gameLoop);
}