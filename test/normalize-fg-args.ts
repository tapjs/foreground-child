import t from 'tap'
import { FgArgs, normalizeFgArgs } from '../dist/cjs/index.js'

const cases: FgArgs[] = [
  ['cmd', ['a', 'b']],
  [['cmd', 'a', 'b']],
  [['cmd']],
  [['cmd'], undefined],
  ['cmd'],
  ['cmd', undefined],
]

cases.push(...cases.map(c => [...c, function x() {}] as unknown as FgArgs))

t.plan(cases.length)
for (const c of cases) {
  t.test(JSON.stringify(c), t => {
    const norm = normalizeFgArgs(c)
    norm[2](0, null)
    t.equal(norm[0], 'cmd')
    if (Array.isArray(c[1])) {
      t.equal(norm[1], c[1])
    } else if (Array.isArray(c[0]) && c[0].length === 3) {
      t.strictSame(norm[1], ['a', 'b'])
    } else {
      t.strictSame(norm[1], [])
    }
    if (typeof c[c.length - 1] === 'function') {
      t.equal(norm[2], c[c.length - 1])
    } else {
      t.type(norm[2], 'function')
    }
    t.end()
  })
}
