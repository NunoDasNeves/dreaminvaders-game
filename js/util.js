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

/*
 * ##############
 * 2d Vectors
 * ##############
 */

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
    if ( len < 0.0001 ) {
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
    return vecNorm(v);
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
    if ( len < 0.0001 ) {
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
    if (len < 0.0001) {
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