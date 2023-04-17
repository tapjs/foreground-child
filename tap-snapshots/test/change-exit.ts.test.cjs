/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/change-exit.ts TAP [0,"SIGTERM",true,[null,"SIGTERM"]] > must match snapshot 1`] = `
Object {
  "change": "SIGTERM",
  "childExit": Object {
    "actual": Array [
      0,
      null,
    ],
    "expect": Array [
      0,
      null,
    ],
  },
  "defer": true,
  "parentExit": Object {
    "expect": Array [
      null,
      "SIGTERM",
    ],
  },
}
`

exports[`test/change-exit.ts TAP [0,1,false,[1,null]] > must match snapshot 1`] = `
Object {
  "change": 1,
  "childExit": Object {
    "actual": Array [
      0,
      null,
    ],
    "expect": Array [
      0,
      null,
    ],
  },
  "defer": false,
  "parentExit": Object {
    "expect": Array [
      1,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [0,null,false,[0,null]] > must match snapshot 1`] = `
Object {
  "childExit": Object {
    "actual": Array [
      0,
      null,
    ],
    "expect": Array [
      0,
      null,
    ],
  },
  "defer": false,
  "parentExit": Object {
    "expect": Array [
      0,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [0,null,true,[0,null]] > must match snapshot 1`] = `
Object {
  "childExit": Object {
    "actual": Array [
      0,
      null,
    ],
    "expect": Array [
      0,
      null,
    ],
  },
  "defer": true,
  "parentExit": Object {
    "expect": Array [
      0,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [3,"SIGTERM",false,[null,"SIGTERM"]] > must match snapshot 1`] = `
Object {
  "change": "SIGTERM",
  "childExit": Object {
    "actual": Array [
      3,
      null,
    ],
    "expect": Array [
      3,
      null,
    ],
  },
  "defer": false,
  "parentExit": Object {
    "expect": Array [
      null,
      "SIGTERM",
    ],
  },
}
`

exports[`test/change-exit.ts TAP [3,1,true,[1,null]] > must match snapshot 1`] = `
Object {
  "change": 1,
  "childExit": Object {
    "actual": Array [
      3,
      null,
    ],
    "expect": Array [
      3,
      null,
    ],
  },
  "defer": true,
  "parentExit": Object {
    "expect": Array [
      1,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [3,false,false,[33,null]] > must match snapshot 1`] = `
Object {
  "change": false,
  "childExit": Object {
    "actual": Array [
      3,
      null,
    ],
    "expect": Array [
      3,
      null,
    ],
  },
  "defer": false,
  "parentExit": Object {
    "expect": Array [
      33,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [3,false,true,[33,null]] > must match snapshot 1`] = `
Object {
  "change": false,
  "childExit": Object {
    "actual": Array [
      3,
      null,
    ],
    "expect": Array [
      3,
      null,
    ],
  },
  "defer": true,
  "parentExit": Object {
    "expect": Array [
      33,
      null,
    ],
  },
}
`

exports[`test/change-exit.ts TAP [3,null,false,[3,null]] > must match snapshot 1`] = `
Object {
  "childExit": Object {
    "actual": Array [
      3,
      null,
    ],
    "expect": Array [
      3,
      null,
    ],
  },
  "defer": false,
  "parentExit": Object {
    "expect": Array [
      3,
      null,
    ],
  },
}
`
