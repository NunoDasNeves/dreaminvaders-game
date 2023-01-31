function getQuotedString(retArr, text, startIdx)
{
    let esc = false;
    let done = false;
    let n = 0;
    const arr = [];

    for (let i = startIdx; !done && i < text.length; ++i,++n) {
        const c = text.charAt(i);
        switch (c) {
            case '"':
            {
                if (esc) {
                    arr.push('"');
                    esc = false;
                } else {
                    esc = true;
                }
                break;
            }
            default:
            {
                if (esc) {
                    done = true;
                } else {
                    arr.push(c);
                }
                break;
            }
        }
    }
    retArr.push(arr.join(''));
    return n;
}

function getUnquotedString(retArr, text, startIdx)
{
    let done = false;
    let n = 0;
    const arr = [];

    for (let i = startIdx; !done && i < text.length; ++i,++n) {
        const c = text.charAt(i);
        switch (c) {
            case ',':
            case '\n':
            {
                done = true;
                n--; // omit it
                break;
            }
            case '\r':
            {
                break;
            }
            default:
            {
                arr.push(c);
                break;
            }
        }
    }
    retArr.push(arr.join(''));
    return n;
}

export function parse(text)
{
    const quoteField = false;
    const ret = [];
    let error = '';
    let expectingField = true;
    let line = [];

    for (let i = 0; i < text.length && error === ''; ++i) {
        const c = text.charAt(i);
        switch (c) {
            case '\n':
            {
                if (expectingField) {
                    line.push('');
                }
                ret.push(line);
                line = [];
                expectingField = true;
                break;
            }
            case ',':
            {
                if (expectingField) {
                    line.push('');
                }
                expectingField = true;
                break;
            }
            case '"':
            {
                if (!expectingField) {
                    error = `Unexpected quoted field at char ${i}`;
                    break;
                }
                const n = getQuotedString(line, text, i + 1);
                i += n - 1;
                if (i >= text.length) {
                    break;
                }
                expectingField = false;
                break;
            }
            default:
            {
                if (!expectingField) {
                    error = `Unexpected field at char ${i}`;
                    break;
                }
                const n = getUnquotedString(line, text, i);
                i += n - 1;
                if (i >= text.length) {
                    break;
                }
                expectingField = false;
                break;
            }
        }
    }
    // avoid extraneous newlines
    if (line.length) {
        ret.push(line);
    }
    return { success: error === '', array: ret, error };
}
