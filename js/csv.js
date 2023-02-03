function getQuotedString(retArr, text, startIdx)
{
    let esc = false;
    let done = false;
    let n = 0;
    const arr = [];

    // we start after the first quote (")
    // continue until an unescaped quote
    // a quote is escaped by...a quote ("")
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
                    // since we are checking the following character ensure the quote wasn't escaped,
                    // n will be one more than it should be when we exit the loop
                    n--;
                } else {
                    if (i == text.length - 1) {
                        return -1;
                    }
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
            // since \r should be followed by \n, we don't want it in the string
            // (but we still count it )
            case '\r':
            {
                break;
            }
            // not allowed
            case '"':
                return -1;
                break;
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
    const ret = [];
    let error = '';
    let expectingField = true;
    let line = [];

    for (let i = 0; i < text.length && error === ''; ) {
        const c = text.charAt(i);
        switch (c) {
            // just skip
            case '\r':
            {
                i++;
                break;
            }
            case '\n':
            {
                if (expectingField) {
                    line.push('');
                }
                ret.push(line);
                line = [];
                expectingField = true;
                i++;
                break;
            }
            case ',':
            {
                if (expectingField) {
                    line.push('');
                }
                expectingField = true;
                i++;
                break;
            }
            case '"':
            {
                /* can't happen
                if (!expectingField) {
                    error = `Unexpected quoted field at char ${i}`;
                    break;
                }
                */
                i++; // parse string starting after the quote
                const n = getQuotedString(line, text, i);
                if (n < 0) {
                    error = `Quoted field didn't end. At char ${i}`;
                    break;
                }
                i += n;
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
                if (n < 0) {
                    error = `Unquoted field contained a quote. At char ${i}`;
                    break;
                }
                i += n;
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

function runTestsError(texts, errorStartsWith)
{
    for (const text of texts) {
        const { success, array, error } = parse(text);
        if (success || !error.startsWith(errorStartsWith)) {
            console.error(`Failed test\n text: ${text}\n errorStartsWith: ${errorStartsWith}`);
            console.error(`success: ${success}`);
            console.error(`error: ${error}`);
            console.error(`array: \n${array}`);
        }
    }
}

function runTestSuccess(text, expected)
{
    const { success, array, error } = parse(text);
    let failed = false;
    if (!success) {
        failed = true;
    } else if (expected.length != array.length) {
        failed = true;
    } else {
        let same = true;
        for (let i = 0; same && i < array.length; ++i) {
            const exp = expected[i];
            const arr = array[i];
            if (exp.length != arr.length) {
                failed = true;
                break;
            }
            for (let j = 0; j < arr.length; ++j) {
                if (exp[j] !== arr[j]) {
                    same = false;
                    failed = true;
                    break;
                }
            }
        }
    }
    if (failed) {
        console.error(`Failed test\n text: ${text} \n expected: \n${expected}`);
        console.error(`success: ${success}`);
        console.error(`error: ${error}`);
        console.error(`array: \n${array}`);
    }
}

export function testParser()
{
    runTestSuccess('yes,yes', [ ['yes', 'yes'] ]);
    runTestSuccess('yes,yes,', [ ['yes', 'yes'] ]);
    runTestSuccess('yes\nyes', [ ['yes'], ['yes'] ]);
    runTestSuccess('yes\nyes\n', [ ['yes'], ['yes'] ]);
    runTestSuccess('yes,yes\nyes,yes', [ ['yes', 'yes'], ['yes', 'yes'] ]);
    runTestSuccess('"yes",yes', [ ['yes', 'yes'] ]);
    runTestSuccess('yes,"yes",', [ ['yes', 'yes'] ]);
    runTestSuccess('"yes"\nyes', [ ['yes'], ['yes'] ]);
    runTestSuccess('yes\n"yes"\n', [ ['yes'], ['yes'] ]);
    runTestSuccess('"yes",yes\nyes,"yes"', [ ['yes', 'yes'], ['yes', 'yes'] ]);
    runTestSuccess('"yes"""', [ ['yes"'] ]);
    runTestSuccess('"ye""s",yes', [ ['ye"s', 'yes'] ]);

    runTestsError(['"no', 'yes,"no', 'yes,yes\n"no'],
                "Quoted field didn't end");
    runTestsError(['"yes"no', 'yes,"yes"no', 'yes,yes\n"yes"no'],
                "Unexpected field");
    runTestsError(['yes"no"', 'yes,yes"no', 'yes,yes\nyes"no'],
                "Unquoted field contained");
}