import t from 'tap'
import { FgArgs, normalizeFgArgs } from '../dist/esm/index.js'

const cases: FgArgs[] = [
  ['cmd', ['a', 'b']],
  [['cmd', 'a', 'b']],
  [['cmd']],
  [['cmd'], undefined],
  [['cmd'], undefined, undefined],
  ['cmd'],
  ['cmd', undefined],
  ['cmd', undefined, undefined],
  ['cmd', ['a', 'b'], undefined],
  ['cmd', ['a', 'b'], { shell: true }],
  ['cmd', { shell: true }],
  ['cmd', ['a', 'b'], { shell: true }],
  ['cmd', { shell: true }, undefined],
]

// Verify that TS rejects invalid argument lists
//@ts-expect-error
let bad: FgArgs = ['cmd', { shell: true }, ['a', 'b']]
bad
//@ts-expect-error
bad = ['cmd', () => {}, { shell: true }]
//@ts-expect-error
bad = ['cmd', () => {}, []]

cases.push(...cases.map(c => [...c, function x() {}] as unknown as FgArgs))

t.plan(cases.length)
for (const c of cases) {
  t.test(JSON.stringify(c), t => {
    const norm = normalizeFgArgs(c)
    norm[3](0, null, {})
    t.equal(norm[0], 'cmd')
    if (Array.isArray(c[1])) {
      t.equal(norm[1], c[1])
    } else if (Array.isArray(c[0]) && c[0].length === 3) {
      t.strictSame(norm[1], ['a', 'b'])
    } else {
      t.strictSame(norm[1], [])
    }
    if (
      (c[1] && typeof c[1] === 'object' && !Array.isArray(c[1])) ||
      (c[2] && typeof c[2] === 'object')
    ) {
      t.strictSame(norm[2], { shell: true })
      //@ts-ignore
      t.notOk(c.includes(norm[2]), 'should get new object')
    } else {
      t.strictSame(norm[2], {})
    }
    if (typeof c[c.length - 1] === 'function') {
      t.equal(norm[3], c[c.length - 1])
    } else {
      t.type(norm[3], 'function')
    }
    t.end()
  })
}
