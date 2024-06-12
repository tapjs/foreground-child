delete process.env.FORCE_COLOR;
process.env.NO_COLOR = '1';
import { onExit } from 'signal-exit';
import { fileURLToPath } from 'url';
import { foregroundChild } from '../../dist/esm/index.js';
const __filename = fileURLToPath(import.meta.url);
const parent = () => {
    console.error('parent', process.pid);
    foregroundChild(process.execPath, [__filename, 'child']);
};
const child = () => {
    console.error('child', process.pid);
    setInterval(() => {
        console.log('child alive');
    }, 200);
    process.on('SIGINT', () => {
        console.log('child SIGINT received');
    });
    process.on('SIGHUP', () => {
        console.log('child SIGHUP received');
    });
    onExit((code, signal) => {
        console.log('child exit', code, signal);
    });
};
switch (process.argv[2]) {
    case 'child':
        child();
        break;
    case 'parent':
        parent();
        break;
}
//# sourceMappingURL=immortal-child.js.map