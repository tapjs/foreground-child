import { spawn } from 'child_process'
import t from 'tap'
import { fileURLToPath } from 'url'

const fixture = fileURLToPath(
  new URL('./fixtures/basic.js', import.meta.url),
)

const winSignals = () => {
  return process.platform === 'win32' ?
      'windows does not support unix signals'
    : false
}

t.jobs = 3
t.test('signals', { skip: winSignals() }, t => {
  const signals = ['SIGTERM', 'SIGHUP', 'SIGKILL']
  t.jobs = signals.length
  for (const sig of signals) {
    t.test(sig, t => {
      t.plan(3)
      const prog = process.execPath
      const args = [fixture, 'parent', sig]
      const child = spawn(prog, args)
      const out: Buffer[] = []
      child.stdout.on('data', c => out.push(c))
      child.on('close', (code, signal) => {
        t.equal(signal, sig)
        t.equal(code, null)
        t.equal(Buffer.concat(out).toString(), 'stdout\n')
      })
    })
  }
  t.end()
})

t.test('exit codes', t => {
  const codes = [0, 1, 2]
  t.jobs = codes.length
  codes.forEach(c =>
    t.test(String(c), t => {
      t.plan(3)
      const prog = process.execPath
      const args = [fixture, 'parent', String(c)]
      const child = spawn(prog, args, {
        stdio: ['pipe', 'pipe', 'inherit'],
      })
      const out: Buffer[] = []
      child.stdout.on('data', c => out.push(c))
      child.on('close', (code, signal) => {
        t.equal(signal, null)
        t.equal(code, c)
        t.equal(Buffer.concat(out).toString(), 'stdout\n')
      })
    }),
  )
  t.end()
})

t.test('parent emits exit when SIGTERMed', { skip: winSignals() }, t => {
  const which = ['parent', 'child', 'nobody']
  t.jobs = which.length
  for (const who of which) {
    t.test('SIGTERM ' + who, t => {
      const prog = process.execPath
      const args = [fixture, 'parent', 'onExit', who]
      const child = spawn(prog, args)
      const out: Buffer[] = []
      child.stdout.on('data', c => out.push(c))
      child.on('close', (_code, signal) => {
        if (who === 'nobody') t.equal(signal, null)
        else t.equal(signal, 'SIGTERM')
        t.equal(Buffer.concat(out).toString(), 'parent exit\n')
        t.end()
      })
    })
  }
  t.end()
})

t.test('beforeExitHandler', t => {
  const codes = [0, 1, 2]
  t.jobs = codes.length
  codes.forEach(c =>
    t.test(String(c), t => {
      t.plan(3)
      const prog = process.execPath
      const args = [fixture, 'parent', String(c), 'beforeExitHandler']
      const child = spawn(prog, args)
      const out: Buffer[] = []
      child.stdout.on('data', c => out.push(c))
      child.on('close', (code, signal) => {
        t.equal(signal, null)
        t.equal(code, c)
        t.equal(
          Buffer.concat(out).toString(),
          'stdout\nbeforeExitHandler\n',
        )
      })
    }),
  )
  t.end()
})

t.test('promiseExitHandler', t => {
  const codes = [0, 1, 2]
  t.jobs = codes.length
  codes.forEach(c => {
    t.test(String(c), t => {
      t.plan(3)
      const prog = process.execPath
      const args = [fixture, 'parent', String(c), 'promiseExitHandler']
      const child = spawn(prog, args)
      const out: Buffer[] = []
      child.stdout.on('data', c => out.push(c))
      child.on('close', (code, signal) => {
        t.equal(signal, null)
        t.equal(code, c)
        t.equal(
          Buffer.concat(out).toString(),
          'stdout\npromiseExitHandler\n',
        )
      })
    })
  })
  t.end()
})

t.test('IPC forwarding', t => {
  t.plan(5)
  const prog = process.execPath
  const args = [fixture, 'parent', 'ipc']
  const child = spawn(prog, args, { stdio: ['ipc', 'pipe', 'pipe'] })
  const out: Buffer[] = []
  const messages: { [k: string]: any }[] = []
  child.on('message', m => messages.push(m as { [k: string]: any }))
  child.stdout?.on('data', c => out.push(c))

  child.send({ data: 'foobar' })
  child.on('close', (code, signal) => {
    t.equal(signal, null)
    t.equal(code, 0)
    t.equal(Buffer.concat(out).toString(), 'stdout\nmessage received\n')
    t.equal(messages.length, 1)
    t.equal(messages?.[0]?.data, 'foobar')
  })
})
