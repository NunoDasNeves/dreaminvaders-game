import * as utils from "./util.js";
Object.entries(utils).forEach(([name, exported]) => window[name] = exported);

import { debug, params, STATE, TEAM, ATKSTATE, weapons, units } from "./data.js";
import { enemyTeam, laneStart, laneEnd, gameState, INVALID_ENTITY_INDEX, EntityRef, updateCameraSize, cameraToWorld, cameraVecToWorld, worldToCamera, worldVecToCamera } from './state.js'
export let canvas = null;
let context = null;

function drawCircleUnit(pos, angle, team, unit)
{
    if (unit.draw.strokeColor) {
        let color = unit.draw.strokeColor;
        if (color == "TEAM") {
            color = params.teamColors[team];
        }
        strokeCircle(pos, unit.radius, 2, color);
    }
    if (unit.draw.fillColor) {
        let color = unit.draw.fillColor;
        if (color == "TEAM") {
            color = params.teamColors[team];
        }
        fillCircle(pos, unit.radius, color);
    }
}

function drawTriangleUnit(pos, angle, team, unit)
{
    let color = unit.draw.fillColor;
    if (color == "TEAM") {
        color = params.teamColors[team];
    }
    fillEquilateralTriangle(pos, angle, unit.radius, unit.radius * 1.5, color);
}

function drawUnit(pos, angle, team, unit)
{
    switch (unit.draw.shape) {
        case "circle":
            drawCircleUnit(pos, angle, team, unit);
            break;
        case "triangle":
            drawTriangleUnit(pos, angle, team, unit);
            break;
        default:
            console.error("invalid unit.draw");
            break;
    }
}

function strokeCircle(worldPos, radius, width, strokeStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    context.beginPath();
    context.arc(coords.x, coords.y, radius / gameState.camera.scale, 0, 2 * Math.PI);
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.strokeStyle = strokeStyle;
    context.stroke();
}

function fillCircle(worldPos, radius, fillStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    context.beginPath();
    context.arc(coords.x, coords.y, radius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fillStyle = fillStyle;
    context.fill();
}

function strokeHalfCapsule(worldPos, length, radius, angle, width, strokeStyle)
{
    const worldLineLen = length - radius;
    const dir = vecFromAngle(angle);
    const line = vecMul(dir, worldLineLen);
    const worldEnd = vecAdd(worldPos, line);
    const endCoords = worldToCamera(worldEnd.x, worldEnd.y); // where the circle center will be
    const originCoords = worldToCamera(worldPos.x, worldPos.y); // start of the line
    vecRotateBy(dir, Math.PI/2); // get the direction where we'll offset to get the side lines of the capsule
    const offset = vecMul(dir, radius);
    const left = vecAdd(worldPos, offset);
    vecNegate(offset);
    const right = vecAdd(worldPos, offset);
    const leftOrigCoords = worldVecToCamera(left);
    const rightOrigCoords = worldVecToCamera(right);
    vecAddTo(left, line);
    vecAddTo(right, line);
    const leftEndCoords = worldVecToCamera(left);
    const rightEndCoords = worldVecToCamera(right);

    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;
    context.strokeStyle = strokeStyle;

    context.beginPath();
    context.moveTo(leftOrigCoords.x, leftOrigCoords.y);
    context.lineTo(leftEndCoords.x, leftEndCoords.y);
    context.moveTo(rightOrigCoords.x, rightOrigCoords.y);
    context.lineTo(rightEndCoords.x, rightEndCoords.y);
    context.arc(endCoords.x, endCoords.y, radius / gameState.camera.scale, angle - Math.PI/2, angle + Math.PI/2);
    context.stroke();
}

function fillEquilateralTriangle(worldPos, angle, base, height, fillStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledBase = base / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    // points right - so angle == 0
    const triPoints = [
        vec(-scaledHeight/2, -scaledBase/2),
        vec(scaledHeight/2, 0),
        vec(-scaledHeight/2, scaledBase/2),
    ];

    // rotate to angle
    triPoints.forEach((v) => vecRotateBy(v, angle));

    // move to coords
    triPoints.forEach((v) => vecAddTo(v, coords));

    context.beginPath();
    context.moveTo(triPoints[2].x, triPoints[2].y);
    for (let i = 0; i < triPoints.length; ++i) {
        context.lineTo(triPoints[i].x, triPoints[i].y);
    }

    context.fillStyle = fillStyle;
    context.fill();

}

function drawRectangle(worldPos, width, height, fillStyle, fromCenter=false) {
    let coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledWidth = width / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    if (fromCenter) {
        coords.x -= scaledWidth / 2;
        coords.y -= scaledHeight / 2;
    }
    context.beginPath();
    context.rect(coords.x, coords.y, scaledWidth, scaledHeight);
    context.fillStyle = fillStyle;
    context.fill();
}

function drawBase(team, base)
{
    const teamColor = params.teamColors[team];
    const coords = worldToCamera(base.pos.x, base.pos.y);
    var gradient = context.createRadialGradient(coords.x, coords.y, (params.baseRadius - 50) / gameState.camera.scale, coords.x, coords.y, params.baseVisualRadius / gameState.camera.scale);
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, params.baseFadeColor);

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(coords.x, coords.y, params.baseVisualRadius / gameState.camera.scale, 0, 2 * Math.PI);
    context.fill();
}

function drawArrow(start, end, width, strokeStyle)
{
    const startCoords = worldVecToCamera(start);
    const endCoords = worldVecToCamera(end);
    // arrow as a vector in screen space
    const arrowDir = utils.vecSub(endCoords, startCoords);
    const arrowLen = vecLen(arrowDir);
    const barbX = arrowLen*7/8;
    const barby = arrowLen/8;
    // arrow points to rotate
    const arrowPoints = [
        vec(),              // start
        vec(arrowLen, 0),   // end
        vec(barbX, barby),  // right
        vec(barbX, -barby), // left
    ];
    const arrowAngle = vecToAngle(arrowDir);
    arrowPoints.forEach(v => vecRotateBy(v, arrowAngle));
    arrowPoints.forEach(v => vecAddTo(v, startCoords));

    context.strokeStyle = strokeStyle;
    context.setLineDash([]);
    context.lineWidth = width / gameState.camera.scale;

    context.beginPath();
    // shaft
    context.moveTo(arrowPoints[0].x, arrowPoints[0].y);
    context.lineTo(arrowPoints[1].x, arrowPoints[1].y);
    // barbs
    context.moveTo(arrowPoints[2].x, arrowPoints[2].y);
    context.lineTo(arrowPoints[1].x, arrowPoints[1].y);
    context.lineTo(arrowPoints[3].x, arrowPoints[3].y);
    context.stroke();
}

function drawLane(lane)
{
    context.beginPath();
    let coords = worldToCamera(lane.points[0].x, lane.points[0].y);
    context.moveTo(coords.x, coords.y);

    for (let i = 1; i < lane.points.length; ++i) {
        coords = worldToCamera(lane.points[i].x, lane.points[i].y);
        context.lineTo(coords.x, coords.y);
        context.strokeStyle = params.laneColor;
        // Clear line dash
        context.setLineDash([]);
        context.lineWidth = params.laneWidth / gameState.camera.scale;
        context.stroke();
    }
}

export function getBoundingClientRect()
{
    return canvas.getBoundingClientRect();
}

export function draw()
{
    updateCameraSize(canvas.width, canvas.height);

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = params.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const [team, base] of Object.entries(gameState.bases)) {
        drawBase(team, base);
    }

    for (let i = 0; i < gameState.lanes.length; ++i) {
        drawLane(gameState.lanes[i]);
    }

    const { exists, team, unit, pos, angle, physState, boidState } = gameState.entities;
    for (let i = 0; i < exists.length; ++i) {
        if (!exists[i]) {
            continue;
        }
        drawUnit(pos[i], angle[i], team[i], unit[i]);
        if (debug.drawRadii) {
            strokeCircle(pos[i], unit[i].radius, 1, physState[i].colliding ? 'red' : '#880000');
        }
        if (debug.drawSight && unit[i].sightRadius > 0)
        {
            strokeCircle(pos[i], unit[i].sightRadius, 1, 'yellow');
        }
        if (unit[i] == units.boid)
        {
            if (debug.drawCapsule) // && unit[i].avoiding)
            {
                strokeHalfCapsule(pos[i], unit[i].sightRadius, unit[i].radius, vecToAngle(boidState[i].seekForce), 1, boidState[i].avoiding ? '#00ff00' : 'green');
            }
            if (debug.drawForces)
            {
                if (boidState[i].avoiding) {
                    drawArrow(pos[i], vecAdd(pos[i], vecMul(boidState[i].avoidanceForce, 20)), 1, 'red');
                }
                drawArrow(pos[i], vecAdd(pos[i], vecMul(boidState[i].seekForce, 20)), 1, 'white');
            }
        }

    }
}

export function init()
{
    canvas = document.getElementById("gamecanvas");
    context = canvas.getContext("2d");
}