import * as Utils from "./util.js";
import * as State from "./state.js";
Object.entries(Utils).forEach(([name, exported]) => window[name] = exported);
Object.entries(State).forEach(([name, exported]) => window[name] = exported);

const fontSmol = '20px sans-serif';
function makeFont(sz)
{
    return `${sz}px sans-serif`
}

export function getTextDims(ctx, string, font, align='left', baseline='alphabetic')
{
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    const metrics = ctx.measureText(string);
    return {
        fontHeight: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
        actualHeight: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
        width: metrics.width,
    };
}

export function strokeTextScreen(ctx, string, pos, font, width, strokeStyle, align='left', baseline='alphabetic')
{
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.strokeStyle = strokeStyle;
    ctx.setLineDash([]);
    ctx.lineWidth = width;
    ctx.strokeText(string, pos.x, pos.y);
}

export function fillTextScreen(ctx, string, pos, font, fillStyle, align='left', baseline='alphabetic')
{
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = fillStyle;
    ctx.fillText(string, pos.x, pos.y);
}

export function fillTextWorld(ctx, string, pos, sizePx, fillStyle, align='left', baseline='alphabetic')
{
    const scaledSize = sizePx / gameState.camera.scale;
    const coords = worldVecToCamera(pos);
    fillTextScreen(ctx, string, coords, makeFont(scaledSize), fillStyle, align, baseline);
}

export function strokeTextWorld(ctx, string, pos, sizePx, width, strokeStyle, align='left', baseline='alphabetic')
{
    const scaledSize = sizePx / gameState.camera.scale;
    const scaledWidth = width / gameState.camera.scale;
    const coords = worldVecToCamera(pos);
    strokeTextScreen(ctx, string, coords, makeFont(scaledSize), scaledWidth, strokeStyle, align, baseline);
}

export function strokeRectScreen(ctx, pos, dims, strokeStyle)
{
    ctx.strokeStyle = strokeStyle;
    ctx.strokeRect(pos.x, pos.y, dims.x, dims.y);
}

export function fillRectScreen(ctx, pos, dims, fillStyle, cornerRadii = 0)
{
    ctx.fillStyle = fillStyle;
    if (ctx.roundRect && cornerRadii > 0) {
        ctx.beginPath();
        ctx.roundRect(pos.x, pos.y, dims.x, dims.y, cornerRadii);
        ctx.fill();
    } else {
        ctx.fillRect(pos.x, pos.y, dims.x, dims.y);
    }
}

export function fillRectWorld(ctx, pos, dims, fillStyle, cornerRadii = 0)
{
    fillRectScreen(
        ctx,
        worldVecToCamera(pos),
        vec(dims.x / gameState.camera.scale, dims.y / gameState.camera.scale),
        fillStyle,
        cornerRadii
    );
}

export function strokeCircleScreen(ctx, pos, radius, width, strokeStyle)
{
    ctx.setLineDash([]);
    ctx.lineWidth = width;
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
}

export function fillCircleScreen(ctx, pos, radius, fillStyle)
{
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

export function strokeCircleWorld(ctx, worldPos, radius, width, strokeStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    strokeCircleScreen(
        ctx,
        coords,
        radius / gameState.camera.scale,
        width / gameState.camera.scale,
        strokeStyle
    );
}

export function fillCircleWorld(ctx, worldPos, radius, fillStyle)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    fillCircleScreen(
        ctx,
        coords,
        radius / gameState.camera.scale,
        fillStyle
    );
}

export function strokeLineWorld(ctx, posFrom, posTo, width, strokeStyle) {
    const posFromScreen = worldVecToCamera(posFrom);
    const posToScreen = worldVecToCamera(posTo);
    ctx.strokeStyle = strokeStyle;
    ctx.setLineDash([]);
    ctx.lineWidth = width / gameState.camera.scale;
    ctx.beginPath();
    ctx.moveTo(posFromScreen.x, posFromScreen.y);
    ctx.lineTo(posToScreen.x, posToScreen.y);
    ctx.stroke();
}

export function fillTriangleWorld(ctx, worldPos, angle, base, height, fillStyle, fromCenter=true)
{
    const coords = worldToCamera(worldPos.x, worldPos.y);
    const scaledBase = base / gameState.camera.scale;
    const scaledHeight = height / gameState.camera.scale;
    // points right - so angle == 0
    const triPoints = fromCenter ?
        [
            vec(-scaledHeight/2, -scaledBase/2),
            vec(scaledHeight/2, 0),
            vec(-scaledHeight/2, scaledBase/2),
        ] :
        [
            vec(0, -scaledBase/2),
            vec(scaledHeight, 0),
            vec(0, scaledBase/2),
        ];

    // rotate to angle
    triPoints.forEach((v) => vecRotateBy(v, angle));

    // move to coords
    triPoints.forEach((v) => vecAddTo(v, coords));

    ctx.beginPath();
    ctx.moveTo(triPoints[2].x, triPoints[2].y);
    for (let i = 0; i < triPoints.length; ++i) {
        ctx.lineTo(triPoints[i].x, triPoints[i].y);
    }

    ctx.fillStyle = fillStyle;
    ctx.fill();
}

function drawImageScreen(ctx, img, pos, dims)
{
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, drawPos.x, drawPos.y, drawDims.width, drawDims.height);
}

function drawImageWorld(ctx, img, pos, dims)
{
    const drawDims = vecMul(dims, 1 / gameState.camera.scale);
    const drawPos = worldVecToCamera(pos);
    drawImageScreen(ctx, img, drawPos, drawDims);
}

