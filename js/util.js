
export function vecAdd(v1, v2)
{
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

export function vecAddTo(v1, v2)
{
    v1.x += v2.x;
    v1.y += v2.y;
    return v1;
}

export function vecSub(v1, v2)
{
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

export function vecSubFrom(v1, v2)
{
    v1.x -= v2.x;
    v1.y -= v2.y;
    return v1;
}

export function vecMul(v, f)
{
    return { x: v.x * f, y: v.y * f };
}

export function vecMulBy(v, f)
{
    v.x *= f;
    v.y *= f;
    return v;
}

export function vecLen(v)
{
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNorm(v)
{
    const len = vecLen(v);
    if ( len < 0.0001 ) {
        console.error("Tried to divide by 0");
        return { x: 0, y: 0 };
    }
    return { x: v.x/len, y: v.y/len }
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

export function vecTangentRight(v)
{
    return {
        x: v.y,
        y: -v.x
    };
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

export function vecClone(v)
{
    return { x: v.x, y: v.y };
}

export function vecCopyTo(v1, v2)
{
    v1.x = v2.x;
    v1.y = v2.y;
    return v1;
}

export function vecClear(v)
{
    v.x = 0;
    v.y = 0;
    return v;
}

export function vec(x = 0, y = 0)
{
    return { x, y };
}

export function vecNegate(v)
{
    v.x = -v.x;
    v.y = -v.y;
    return v;
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

export function vecRotateBy(v, a)
{
    const x = v.x*Math.cos(a) - v.y*Math.sin(a);
    const y = v.x*Math.sin(a) + v.y*Math.cos(a);
    v.x = x;
    v.y = y;
    return v;
}

export function vecRand()
{
    const v = vec(Math.random()-0.5, Math.random()-0.5);
    return vecNorm(v);
}

export function getDist(p1, p2)
{
    return vecLen(vecSub(p1, p2));
}