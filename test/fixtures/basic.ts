import { onExit } from 'signal-exit'
import { fileURLToPath } from 'url'
import { foregroundChild, type Cleanup } from '../../dist/esm/index.js'

const __filename = fileURLToPath(import.meta.url)

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
  let cb: Cleanup | undefined = undefined

  // we can optionally assign a beforeExit handler
  // to the foreground-child process; we should test it.
  switch (process.argv[4]) {
    case 'beforeExitHandler':
      cb = exitCode => {
        const expectedExitCode = Number(process.argv[3])
        if (expectedExitCode !== exitCode) {
          console.log('unexpected exit code', expectedExitCode, exitCode)
        }

        console.log('beforeExitHandler')
      }
      break
    case 'promiseExitHandler':
      cb = async exitCode => {
        const expectedExitCode = Number(process.argv[3])
        if (expectedExitCode !== exitCode) {
          console.log('unexpected exit code', expectedExitCode, exitCode)
        }

        console.log('promiseExitHandler')
      }
      break
  }

  const program = process.execPath
  const args = [__filename, 'child'].concat(process.argv.slice(3))
  const child = foregroundChild(program, args, cb)

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

switch (process.argv[2]) {
  case 'child':
    childMain()
    break
  case 'parent':
    parentMain()
    break
}
