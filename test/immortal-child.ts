import { spawn } from 'child_process'
import t from 'tap'
import { fileURLToPath } from 'url'

const fixture = fileURLToPath(
  new URL('./fixtures/immortal-child.js', import.meta.url),
)

if (process.platform === 'win32') {
  t.plan(0, 'skip on windows')
  process.exit(0)
}

const proc = spawn(process.execPath, [fixture, 'parent'])

let out = ''
let timer: NodeJS.Timeout
proc.stdout.on('data', c => {
  out += c
  if (/\nchild alive\n/.test(out) && timer === undefined) {
    const time = 200
    timer = setTimeout(() => {
      proc.kill('SIGINT')
      timer = setTimeout(() => {
        proc.kill('SIGTERM')
      }, time)
    }, time)
  }
})

let err = ''
proc.stderr.on('data', c => {
  err += c
})

proc.on('exit', () => timer !== undefined && clearTimeout(timer))
proc.on('close', (code, signal) => {
  const actual = {
    out: out,
    err: err,
    code: code,
    signal: signal,
  }
  const expect = {
    out: /^(child alive\n)*child SIGINT received\n(child alive\n)*child exit null SIGTERM\n$/,
    err: /^parent \d+\nchild \d+\n$/,
    code: null,
    signal: 'SIGTERM',
  }
  t.match(actual, expect)
  t.end()
})
