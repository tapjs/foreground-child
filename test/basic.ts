import { spawn } from 'child_process'
import { onExit, Handler } from 'signal-exit'
import t from 'tap'
import { foregroundChild as fg } from '../dist/cjs/index.js'

const childMain = () => {
  setTimeout(() => {}, 1000)
  console.log('stdout')
  switch (process.argv[3]) {
    case 'SIGTERM':
    case 'SIGHUP':
    case 'SIGKILL':
      process.kill(process.pid, process.argv[3])
      break

    case '0':
    case '1':
    case '2':
      return process.exit(+process.argv[3])

    case 'ipc':
      process.on('message', m => {
        if (!process.send) {
          throw new Error('lost process.send somehow')
        }
        console.log('message received')
        process.send(m)
        process.exit(0)
      })
      break
  }
}

const parentMain = () => {
  let cb: Handler | undefined = undefined

  // we can optionally assign a beforeExit handler
  // to the foreground-child process; we should test it.
  switch (process.argv[4]) {
    case 'beforeExitHandler':
      cb = (exitCode) => {
        const expectedExitCode = +process.argv[3]
        if (expectedExitCode !== exitCode) {
          console.log(
            'unexpected exit code',
            expectedExitCode,
            exitCode
          )
        }

        console.log('beforeExitHandler')
      }
      break
    case 'promiseExitHandler':
      cb = async (exitCode) => {
        const expectedExitCode = +process.argv[3]
        if (expectedExitCode !== exitCode) {
          console.log(
            'unexpected exit code',
            expectedExitCode,
            exitCode
          )
        }

        console.log('promiseExitHandler')
      }
      break
  }

  const program = process.execPath
  const args = [
    '--loader=ts-node/esm',
    '--no-warnings',
    __filename,
    'child',
  ].concat(process.argv.slice(3))
  const child = fg(program, args, cb)

  if (process.argv[3] === 'onExit') {
    onExit(() => console.log('parent exit'))
    switch (process.argv[4]) {
      case 'parent':
        process.kill(process.pid, 'SIGTERM')
        setTimeout(() => {}, 200)
        break
      case 'child':
        process.kill(child.pid as number, 'SIGTERM')
        setTimeout(() => {}, 200)
        break
      default:
        return process.exit()
    }
  }
}

const test = () => {
  t.jobs = 3
  t.test('signals', { skip: winSignals() }, t => {
    const signals = ['SIGTERM', 'SIGHUP', 'SIGKILL']
    t.jobs = signals.length
    for (const sig of signals) {
      t.test(sig, t => {
        t.plan(3)
        const prog = process.execPath
        const args = [
          '--loader=ts-node/esm',
          '--no-warnings',
          __filename,
          'parent',
          sig,
        ]
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
        const args = [
          '--loader=ts-node/esm',
          '--no-warnings',
          __filename,
          'parent',
          String(c),
        ]
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
      })
    )
    t.end()
  })

  t.test('parent emits exit when SIGTERMed', { skip: winSignals() }, t => {
    const which = ['parent', 'child', 'nobody']
    t.jobs = which.length
    for (const who of which) {
      t.test('SIGTERM ' + who, t => {
        const prog = process.execPath
        const args = [
          '--loader=ts-node/esm',
          '--no-warnings',
          __filename,
          'parent',
          'onExit',
          who,
        ]
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
        const args = [
          '--loader=ts-node/esm',
          '--no-warnings',
          __filename,
          'parent',
          String(c),
          'beforeExitHandler',
        ]
        const child = spawn(prog, args)
        const out: Buffer[] = []
        child.stdout.on('data', c => out.push(c))
        child.on('close', (code, signal) => {
          t.equal(signal, null)
          t.equal(code, c)
          t.equal(
            Buffer.concat(out).toString(),
            'stdout\nbeforeExitHandler\n'
          )
        })
      })
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
        const args = [
          '--loader=ts-node/esm',
          '--no-warnings',
          __filename,
          'parent',
          String(c),
          'promiseExitHandler',
        ]
        const child = spawn(prog, args)
        const out: Buffer[] = []
        child.stdout.on('data', c => out.push(c))
        child.on('close', (code, signal) => {
          t.equal(signal, null)
          t.equal(code, c)
          t.equal(
            Buffer.concat(out).toString(),
            'stdout\npromiseExitHandler\n'
          )
        })
      })
    })
    t.end()
  })

  t.test('IPC forwarding', t => {
    t.plan(5)
    const prog = process.execPath
    const args = [
      '--loader=ts-node/esm',
      '--no-warnings',
      __filename,
      'parent',
      'ipc',
    ]
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
}

const winSignals = () => {
  return process.platform === 'win32'
    ? 'windows does not support unix signals'
    : false
}

switch (process.argv[2]) {
  case 'child':
    childMain()
    break
  case 'parent':
    parentMain()
    break
  case undefined:
    test()
    break
}
