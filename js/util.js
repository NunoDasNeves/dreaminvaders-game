/*
 * only supports:
 *   rgb(x,y,z)
 *   rgba(x,y,z,w)
 *   #fff
 *   #AAA0
 *   #FFFFFF
 *   #ffffff00
 * returns { r, g, b, a }, all from 0-1
 */
const rgbRe = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/;
const hex4Re = /^#([\dabcdef])([\dabcdef])([\dabcdef])([\dabcdef])?$/i;
const hex8Re = /^#([\dabcdef][\dabcdef])([\dabcdef][\dabcdef])([\dabcdef][\dabcdef])(?:([\dabcdef][\dabcdef]))?$/i;
export function colorStrToObj(cssColor)
{
    const str = cssColor.trim();
    const rgbMatches = str.match(rgbRe);
    if (rgbMatches !== null) {
        const obj = {
            r: parseInt(rgbMatches[1])/255,
            g: parseInt(rgbMatches[2])/255,
            b: parseInt(rgbMatches[3])/255,
            a: 0,
        }
        if (rgbMatches.length == 5) {
            obj.a = parseFloat(rgbMatches[4]);
        }
        return obj;
    }
    let hexMatches = null;
    if (str.length < 7) {
        hexMatches = str.match(hex4Re);
    } else {
        hexMatches = str.match(hex8Re);
    }
    if (hexMatches !== null) {
        const obj = {
            r: parseInt(hexMatches[1], 16)/255,
            g: parseInt(hexMatches[2], 16)/255,
            b: parseInt(hexMatches[3], 16)/255,
            a: 0,
        }
        if (hexMatches.length == 5) {
            obj.a = parseInt(hexMatches[4], 16)/255;
        }
        return obj;
    }
    return null;
}

/*
 * return color as rgba(x,x,x,x)
 */
export function objToColorStr({ r, g, b, a })
{
    return `rgba(${r},${g},${b},${a})`;
}

export function lerp(a, b, t, do_clamp=false)
{
    if (do_clamp) {
        t = clamp(t, 0, 1);
    }
    return a + (b - a) * t;
}

export function invLerp(a, b, x, do_clamp=false)
{
    if (do_clamp) {
        const min = Math.min(a,b);
        const max = Math.max(a,b);
        x = clamp(x, min, max);
    }
    return (x - a)/(b - a);
}

export function remap(in_min, in_max, out_min, out_max, x, do_clamp=false)
{
    const t = invLerp(in_min, in_max, x, do_clamp);
    return lerp(out_min, out_max, t);
}

export function randFromArray(arr)
{
    return arr[Math.floor(Math.random() * arr.length)];
}

export function pointInAABB(point, topLeft, dims)
{
    if (point.x < topLeft.x || point.x >= (topLeft.x + dims.x)) {
        return false;
    }
    if (point.y < topLeft.y || point.y >= (topLeft.y + dims.y)) {
        return false;
    }
    return true;
}

/*
 * Get info about relationship between point and the closest point on lineSegs;
 * lineSegs is a list of points treated as joined line segments.
 * Returns: {
 *      baseIdx,    // index in lineSegs of 'base' of line which point is closest to, (can never be the last index in lineSegs)
 *      point,      // point on lineSegs which is closest to point argument
 *      dir,        // direction from point on lineSegs to point argument. zero vector if point is very close to the line
 *      dist,       // distance from point arg to closest point on lineSegs
 * }
 */
export function pointNearLineSegs(point, lineSegs)
{
    let minBaseIdx = 0;
    let minPoint = null;
    let minDir = null;
    let minDist = Infinity;
    const lastIdx = lineSegs.length - 1;
    console.assert(lastIdx > 0);

    for (let i = 0; i < lastIdx; ++i) { // omit last idx
        const capsuleLine = vecSub(lineSegs[i+1], lineSegs[i]);
        const lineLen = vecLen(capsuleLine);
        const baseToPoint = vecSub(point, lineSegs[i]);
        if (almostZero(lineLen)) {
            const d = vecLen(baseToPoint);
            if (d < minDist) {
                minDist = d;
                minBaseIdx = i;
                minPoint = vecClone(lineSegs[i]);
                minDir = almostZero(d) ? vec() : vecMul(baseToPoint, 1/d);
            }
            continue;
        }
        const lineDir = vecMul(capsuleLine, 1/lineLen);
        const distAlongLine = vecDot(lineDir, baseToPoint);
        if (distAlongLine < 0) {
            const d = vecLen(baseToPoint);
            if (d < minDist) {
                minDist = d;
                minBaseIdx = i;
                minPoint = vecClone(lineSegs[i]);
                minDir = almostZero(d) ? vec() : vecMul(baseToPoint, 1/d);
            }
        } else if (distAlongLine > lineLen) {
            const dir = vecSub(point, lineSegs[i+1]);
            const d = vecLen(dir);
            if (d < minDist) {
                minDist = d;
                minBaseIdx = i; // its always the 'base' of the segment, so it is i and not i+1
                minPoint = vecClone(lineSegs[i+1]);
                minDir = almostZero(d) ? vec() : vecMul(dir, 1/d);
            }
        } else {
            const pointOnLine = vecAddTo(vecMul(lineDir, distAlongLine), lineSegs[i]);
            const dir = vecSub(point, pointOnLine);
            const d = vecLen(dir);
            if (d < minDist) {
                minDist = d;
                minBaseIdx = i;
                minPoint = pointOnLine;
                minDir = almostZero(d) ? vec() : vecMul(dir, 1/d);
            }
        }
    }
    return { baseIdx: minBaseIdx, point: minPoint, dir: minDir, dist: minDist };
}

/*
 * Map a list 'data' like [{ id: 0, ... }, { id: 1, ... }, ... ] to an object like { 0: { id, ... }, 1: { id, ... } }
 * Require that the list elements have all keys in the 'required' list
 * Any keys not present which are in 'defaults' are replaced by the value in 'defaults'
 * Use 'name' to print an error
 */
export function makeFromDefaults(name, data, defaults, required) {
    return Object.freeze(
        data.reduce((acc, item) => {
            for (const key of required) {
                if (!(key in item)) {
                    console.error(`Required property ${key} missing from an item in ${name} data`);
                    return acc;
                }
            }
            for (const [key, val] of Object.entries(defaults)) {
                if (!(key in item)) {
                    item[key] = val;
                }
            }
            acc[item.id] = item;
            return acc;
        }, {})
    );
}

export function clamp(x, min, max)
{
    if (x < min) {
        return min;
    }
    if (x > max) {
        return max;
    }
    return x;
}

export function almostZero(x)
{
    return Math.abs(x) < 0.0001;
}

export function reverseToNewArray(arr)
{
    const newArr = [];
    for (let i = arr.length-1; i >= 0; --i) {
        newArr.push(arr[i]);
    }
    return newArr;
}

export function cubicBezierPoint(ctrlPoints, t)
{
    // (1-t)^3P_0 + 3t(1-t)^2P_1 + 3t^2(1-t)P_2 + t^3P_3
    console.assert(t >= 0 && t <= 1);
    console.assert(ctrlPoints.length == 4);
    const oneMinusT = 1-t;
    const oneMinusTSquared = oneMinusT*oneMinusT;
    const tSquared = t*t;
    const terms = [null,null,null,null];
    terms[0] = vecMul(ctrlPoints[0],   oneMinusTSquared*oneMinusT  );
    terms[1] = vecMul(ctrlPoints[1], 3*oneMinusTSquared          *t);
    terms[2] = vecMul(ctrlPoints[2], 3*oneMinusT                 *tSquared);
    terms[3] = vecMul(ctrlPoints[3],                              tSquared*t);
    const result1 = vecAddTo(terms[0], terms[1]);
    const result2 = vecAddTo(terms[2], terms[3]);

    return vecAdd(result1, result2);
}

/*
 * ##############
 * 2d Vectors
 * ##############
 */

export function vecAlmostZero(v)
{
    return Math.abs(v.x) < 0.0001 && Math.abs(v.y) < 0.0001;
}

// Functions that return a new vector object

export function vec(x = 0, y = 0)
{
    return { x, y };
}

export function vecClone(v)
{
    return { x: v.x, y: v.y };
}

export function vecAdd(v1, v2)
{
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

export function vecSub(v1, v2)
{
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

export function vecMul(v, f)
{
    return { x: v.x * f, y: v.y * f };
}

export function vecNorm(v)
{
    const len = vecLen(v);
    if ( almostZero(len) ) {
        console.error("Tried to divide by 0");
        return { x: 0, y: 0 };
    }
    const f = 1/len;
    return { x: v.x * f, y: v.y * f };
}

export function vecTangentRight(v)
{
    return {
        x: v.y,
        y: -v.x
    };
}

export function vecRand()
{
    const v = vec(Math.random()-0.5, Math.random()-0.5);
    return v;
}

export function vecRandDir()
{
    const v = vec(Math.random()-0.5, Math.random()-0.5);
    return vecNormalize(v);
}

// In-place functions, prefer these whenever possible to avoid creating a new object

export function vecClear(v)
{
    v.x = 0;
    v.y = 0;
    return v;
}

export function vecCopyTo(v1, v2)
{
    v1.x = v2.x;
    v1.y = v2.y;
    return v1;
}

export function vecAddTo(v1, v2)
{
    v1.x += v2.x;
    v1.y += v2.y;
    return v1;
}

export function vecSubFrom(v1, v2)
{
    v1.x -= v2.x;
    v1.y -= v2.y;
    return v1;
}

export function vecMulBy(v, f)
{
    v.x *= f;
    v.y *= f;
    return v;
}

export function vecFloor(v)
{

    v.x = Math.floor(v.x);
    v.y = Math.floor(v.y);
    return v;
}

export function vecNormalize(v)
{
    const len = vecLen(v);
    if ( almostZero(len) ) {
        console.error("Tried to divide by 0");
        v.x = 0;
        v.y = 0;
    } else {
        v.x /= len;
        v.y /= len;
    }

    return v;
}

export function vecSetMag(v, mag)
{
    return vecMulBy(vecNormalize(v), mag);
}

export function vecClampMag(v, min, max)
{
    const len = vecLen(v);
    if ( almostZero(len) ) {
        // if min is zero, then just zero and return
        if ( almostZero(min) ) {
            v.x = 0;
            v.y = 0;
            return v;
        }
        console.error("Tried to divide by 0");
        return vecClear(v);
    }
    const clampedLen = clamp(len, min, max);
    return vecMulBy(v, clampedLen/len);
}

export function vecNegate(v)
{
    v.x = -v.x;
    v.y = -v.y;
    return v;
}

export function vecRotateBy(v, a)
{
    const x = v.x*Math.cos(a) - v.y*Math.sin(a);
    const y = v.x*Math.sin(a) + v.y*Math.cos(a);
    v.x = x;
    v.y = y;
    return v;
}

// Vector to scalar and scalar to vector functions

export function vecLen(v)
{
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecDot(v1, v2)
{
    return v1.x * v2.x + v1.y * v2.y;
}

export function vecScalarCross(v1, v2)
{
    return v1.x * v2.y - v1.y * v2.x;
}

export function vecToAngle(v)
{
    return Math.atan2(v.y, v.x);
}

export function vecFromAngle(a)
{
    return {
        x: Math.cos(a),
        y: Math.sin(a)
    }
}

export function getDist(p1, p2)
{
    return vecLen(vecSub(p1, p2));
}