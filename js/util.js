
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

export function vecClone(v)
{
    return { x: v.x, y: v.y };
}

export function vecClear(v)
{
    v.x = 0;
    v.y = 0;
}

export function vec(x = 0, y = 0)
{
    return { x, y };
}

export function vecDot(v1, v2)
{
    return v1.x * v2.x + v1.y * v2.y;
}

export function vecToAngle(v)
{
    const n = vecNorm(v);
    return Math.atan2(n.y, n.x);
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