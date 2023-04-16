const node = process.execPath
import { spawn } from 'child_process'
import { onExit } from 'signal-exit'
import t from 'tap'
import { foregroundChild } from '../dist/cjs/index.js'

const test = () => {
  if (process.platform === 'win32') {
    t.plan(0, 'skip on windows')
    return
  }
  var proc = spawn(node, [
    '--loader=ts-node/esm',
    '--no-warnings',
    __filename,
    'parent',
  ])

  var out = ''
  let timer: NodeJS.Timeout
  proc.stdout.on('data', c => {
    out += c
    if (/\nchild alive\n/.test(out) && timer === undefined) {
      var time = 200
      timer = setTimeout(() => {
        proc.kill('SIGINT')
        timer = setTimeout(() => {
          proc.kill('SIGTERM')
        }, time)
      }, time)
    }
  })

  var err = ''
  proc.stderr.on('data', c => {
    err += c
  })

  proc.on('exit', () => timer !== undefined && clearTimeout(timer))
  proc.on('close', (code, signal) => {
    var actual = {
      out: out,
      err: err,
      code: code,
      signal: signal,
    }
    var expect = {
      out: /^(child alive\n)*child SIGINT received\n(child alive\n)*child exit null SIGTERM\n$/,
      err: /^parent \d+\nchild \d+\n$/,
      code: null,
      signal: 'SIGTERM',
    }
    t.match(actual, expect)
    t.end()
  })
}

const parent = () => {
  console.error('parent', process.pid)
  foregroundChild(node, [
    '--loader=ts-node/esm',
    '--no-warnings',
    __filename,
    'child',
  ])
}

const child = () => {
  console.error('child', process.pid)
  setInterval(() => {
    console.log('child alive')
  }, 200)
  process.on('SIGINT', () => {
    console.log('child SIGINT received')
  })
  process.on('SIGHUP', () => {
    console.log('child SIGHUP received')
  })
  onExit((code, signal) => {
    console.log('child exit', code, signal)
  })
}

switch (process.argv[2]) {
  case 'child':
    child()
    break
  case 'parent':
    parent()
    break
  case undefined:
    test()
    break
}
