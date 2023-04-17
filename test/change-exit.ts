import { spawn } from 'child_process'
import t from 'tap'
import { foregroundChild } from '../dist/cjs/index.js'
const isWin = process.platform === 'win32'

const parent = (childExit: string, changeArg: string, defer: boolean) => {
  const args = [
    '--loader=ts-node/esm',
    '--no-warnings',
    __filename,
    'child',
    String(childExit),
  ]
  spawn(process.execPath, args)
  const asNum = parseInt(childExit, 10)
  const expect = !isNaN(asNum) ? [asNum, null] : [null, childExit]
  const change: number | undefined | false | NodeJS.Signals =
    changeArg === 'undefined'
      ? undefined
      : changeArg === 'false'
      ? false
      : !isNaN(parseInt(changeArg, 10))
      ? parseInt(changeArg, 10)
      : (changeArg as NodeJS.Signals)

  foregroundChild(process.execPath, args, (code, signal) => {
    const parentExitExpect =
      change === false
        ? [33, null]
        : change === undefined
        ? [code, signal]
        : typeof change === 'number'
        ? [change, null]
        : [null, change]
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
    }
    if (change === false) setTimeout(() => process.exit(33), 200)
    if (defer) {
      return new Promise<typeof change>(res =>
        setTimeout(() => {
          console.log('%j', report)
          res(change)
        }, 50)
      )
    } else {
      console.log('%j', report)
      return change
    }
  })
}

const child = (exit: string) => {
  const asNum = parseInt(exit, 10)
  if (!isNaN(asNum)) process.exit(asNum)
  const asSig = exit as NodeJS.Signals
  process.kill(process.pid, asSig)
  setTimeout(() => {}, 200)
}

const main = () => {
  const cases: [
    childExit: number | NodeJS.Signals,
    parentChange: number | undefined | false | NodeJS.Signals,
    defer: boolean,
    expect: [number, null] | [null, NodeJS.Signals]
  ][] = [
    [0, undefined, false, [0, null]],
    [0, undefined, true, [0, null]],
    [0, 1, false, [1, null]],
    [0, 'SIGTERM', true, [null, 'SIGTERM']],
    [3, undefined, false, [3, null]],
    [3, 1, true, [1, null]],
    [3, 'SIGTERM', false, [null, 'SIGTERM']],
    [3, false, false, [33, null]],
    [3, false, true, [33, null]],
  ]
  t.jobs = 4
  t.plan(cases.length)
  for (const c of cases) {
    t.test(JSON.stringify(c), t => {
      const [childExit, parentChange, defer, expect] = c
      const args = [
        '--loader=ts-node/esm',
        '--no-warnings',
        __filename,
        'parent',
        String(childExit),
        String(parentChange),
        defer ? '1' : '0',
      ]
      const p = spawn(process.execPath, args)
      const out: Buffer[] = []
      p.stdout.on('data', c => out.push(c))
      p.on('close', (code, signal) => {
        // windows sometimes exits with 1 exit status when receiving a
        // termination signal.
        !isWin &&
          t.strictSame([code, signal], expect, 'got expected parent exit')
        const report = JSON.parse(String(Buffer.concat(out)))
        t.matchSnapshot(report)
        t.strictSame(report.childExit.actual, report.childExit.expect)
        t.equal(report.defer, defer)
        t.strictSame(report.parentExit.expect, expect)
        t.end()
      })
    })
  }
}

switch (process.argv[2]) {
  case 'parent':
    parent(process.argv[3], process.argv[4], process.argv[5] === '1')
    break
  case 'child':
    child(process.argv[3])
    break
  default:
    main()
    break
}
