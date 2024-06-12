import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { foregroundChild } from '../../dist/esm/index.js';
const __filename = fileURLToPath(import.meta.url);
const parent = (childExit, changeArg, defer) => {
    const args = [__filename, 'child', String(childExit)];
    spawn(process.execPath, args);
    const asNum = parseInt(childExit, 10);
    const expect = !isNaN(asNum) ? [asNum, null] : [null, childExit];
    const change = changeArg === 'undefined' ? undefined
        : changeArg === 'false' ? false
            : !isNaN(parseInt(changeArg, 10)) ? parseInt(changeArg, 10)
                : changeArg;
    foregroundChild(process.execPath, args, (code, signal) => {
        const parentExitExpect = change === false ? [33, null]
            : change === undefined ? [code, signal]
                : typeof change === 'number' ? [change, null]
                    : [null, change];
        const report = {
            childExit: {
                expect,
                actual: [code, signal],
            },
            parentExit: {
                expect: parentExitExpect,
            },
            change,
            defer,
        };
        if (change === false)
            setTimeout(() => process.exit(33), 200);
        if (defer) {
            return new Promise(res => setTimeout(() => {
                console.log('%j', report);
                res(change);
            }, 50));
        }
        else {
            console.log('%j', report);
            return change;
        }
    });
};
const child = (exit) => {
    const asNum = parseInt(exit, 10);
    if (!isNaN(asNum))
        process.exit(asNum);
    const asSig = exit;
    process.kill(process.pid, asSig);
    setTimeout(() => { }, 200);
};
switch (process.argv[2]) {
    case 'parent':
        parent(String(process.argv[3]), String(process.argv[4]), process.argv[5] === '1');
        break;
    case 'child':
        child(String(process.argv[3]));
        break;
}
