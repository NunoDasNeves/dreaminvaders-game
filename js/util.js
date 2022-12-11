
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

export function vec(x = 0, y = 0)
{
    return { x, y };
}