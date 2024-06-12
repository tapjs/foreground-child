import { spawn } from 'child_process'
import t from 'tap'
import { fileURLToPath } from 'url'
const isWin = process.platform === 'win32'

const fixture = fileURLToPath(
  new URL('./fixtures/change-exit.js', import.meta.url),
)

const cases: [
  childExit: number | NodeJS.Signals,
  parentChange: number | undefined | false | NodeJS.Signals,
  defer: boolean,
  expect: [number, null] | [null, NodeJS.Signals],
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
      fixture,
      'parent',
      String(childExit),
      String(parentChange),
      defer ? '1' : '0',
    ]
    const p = spawn(process.execPath, args)
    const out: Buffer[] = []
    p.stdout.on('data', c => out.push(c))
    p.on('close', (code, signal) => {
      const raw = String(Buffer.concat(out))

      // windows sometimes exits with 1 exit status when receiving a
      // termination signal.
      !isWin &&
        t.strictSame([code, signal], expect, 'got expected parent exit')
      const report = JSON.parse(raw)
      t.matchSnapshot(report)
      t.strictSame(report.childExit.actual, report.childExit.expect)
      t.equal(report.defer, defer)
      t.strictSame(report.parentExit.expect, expect)
      t.end()
    })
  })
}
