import {
  ChildProcess,
  SendHandle,
  Serializable,
  spawn as nodeSpawn,
  SpawnOptions,
} from 'child_process'
import crossSpawn from 'cross-spawn'
import { onExit } from 'signal-exit'
import { allSignals } from './all-signals.js'
import { watchdog } from './watchdog.js'

/* c8 ignore start */
const spawn = process?.platform === 'win32' ? crossSpawn : nodeSpawn
/* c8 ignore stop */

/**
 * The signature for the cleanup method.
 *
 * Arguments indicate the exit status of the child process.
 *
 * If a Promise is returned, then the process is not terminated
 * until it resolves, and the resolution value is treated as the
 * exit status (if a number) or signal exit (if a signal string).
 *
 * If `undefined` is returned, then no change is made, and the parent
 * exits in the same way that the child exited.
 *
 * If boolean `false` is returned, then the parent's exit is canceled.
 *
 * If a number is returned, then the parent process exits with the number
 * as its exitCode.
 *
 * If a signal string is returned, then the parent process is killed with
 * the same signal that caused the child to exit.
 */
export type Cleanup = (
  code: number | null,
  signal: null | NodeJS.Signals
) =>
  | void
  | undefined
  | number
  | NodeJS.Signals
  | false
  | Promise<void | undefined | number | NodeJS.Signals | false>

export type FgArgs =
  | [program: string | string[], cleanup?: Cleanup]
  | [program: string[], opts?: SpawnOptions, cleanup?: Cleanup]
  | [program: string, cleanup?: Cleanup]
  | [program: string, opts?: SpawnOptions, cleanup?: Cleanup]
  | [program: string, args?: string[], cleanup?: Cleanup]
  | [
      program: string,
      args?: string[],
      opts?: SpawnOptions,
      cleanup?: Cleanup
    ]

/**
 * Normalizes the arguments passed to `foregroundChild`.
 *
 * Exposed for testing.
 *
 * @internal
 */
export const normalizeFgArgs = (
  fgArgs: FgArgs
): [
  program: string,
  args: string[],
  spawnOpts: SpawnOptions,
  cleanup: Cleanup
] => {
  let [program, args = [], spawnOpts = {}, cleanup = () => {}] = fgArgs
  if (typeof args === 'function') {
    cleanup = args
    spawnOpts = {}
    args = []
  } else if (!!args && typeof args === 'object' && !Array.isArray(args)) {
    if (typeof spawnOpts === 'function') cleanup = spawnOpts
    spawnOpts = args
    args = []
  } else if (typeof spawnOpts === 'function') {
    cleanup = spawnOpts
    spawnOpts = {}
  }
  if (Array.isArray(program)) {
    const [pp, ...pa] = program
    program = pp
    args = pa
  }
  return [program, args, { ...spawnOpts }, cleanup]
}

/**
 * Spawn the specified program as a "foreground" process, or at least as
 * close as is possible given node's lack of exec-without-fork.
 *
 * Cleanup method may be used to modify or ignore the result of the child's
 * exit code or signal. If cleanup returns undefined (or a Promise that
 * resolves to undefined), then the parent will exit in the same way that
 * the child did.
 *
 * Return boolean `false` to prevent the parent's exit entirely.
 */
export function foregroundChild(
  cmd: string | string[],
  cleanup?: Cleanup
): ChildProcess
export function foregroundChild(
  program: string,
  args?: string[],
  cleanup?: Cleanup
): ChildProcess
export function foregroundChild(
  program: string,
  spawnOpts?: SpawnOptions,
  cleanup?: Cleanup
): ChildProcess
export function foregroundChild(
  program: string,
  args?: string[],
  spawnOpts?: SpawnOptions,
  cleanup?: Cleanup
): ChildProcess
export function foregroundChild(...fgArgs: FgArgs): ChildProcess {
  const [program, args, spawnOpts, cleanup] = normalizeFgArgs(fgArgs)

  spawnOpts.stdio = [0, 1, 2]
  if (process.send) {
    spawnOpts.stdio.push('ipc')
  }

  const child = spawn(program, args, spawnOpts)

  const unproxySignals = proxySignals(child)
  const childHangup = () => {
    try {
      child.kill('SIGHUP')

      /* c8 ignore start */
    } catch (_) {
      // SIGHUP is weird on windows
      child.kill('SIGTERM')
    }
    /* c8 ignore stop */
  }
  const removeOnExit = onExit(childHangup)

  const dog = watchdog(child)

  let done = false
  child.on('close', async (code, signal) => {
    dog.kill('SIGKILL')
    /* c8 ignore start */
    if (done) {
      return
    }
    /* c8 ignore stop */
    done = true
    const result = cleanup(code, signal)
    const res = isPromise(result) ? await result : result
    removeOnExit()
    unproxySignals()

    if (res === false) return
    else if (typeof res === 'string') {
      signal = res
      code = null
    } else if (typeof res === 'number') {
      code = res
      signal = null
    }

    if (signal) {
      // If there is nothing else keeping the event loop alive,
      // then there's a race between a graceful exit and getting
      // the signal to this process.  Put this timeout here to
      // make sure we're still alive to get the signal, and thus
      // exit with the intended signal code.
      /* istanbul ignore next */
      setTimeout(() => {}, 2000)
      try {
        process.kill(process.pid, signal)
        /* c8 ignore start */
      } catch (_) {
        process.kill(process.pid, 'SIGTERM')
      }
      /* c8 ignore stop */
    } else {
      process.exit(code || 0)
    }
  })

  if (process.send) {
    process.removeAllListeners('message')

    child.on('message', (message, sendHandle) => {
      process.send?.(message, sendHandle)
    })

    process.on('message', (message, sendHandle) => {
      child.send(
        message as Serializable,
        sendHandle as SendHandle | undefined
      )
    })
  }

  return child
}

/**
 * Starts forwarding signals to `child` through `parent`.
 */
const proxySignals = (child: ChildProcess) => {
  const listeners = new Map()

  for (const sig of allSignals) {
    const listener = () => {
      // some signals can only be received, not sent
      try {
        child.kill(sig)
        /* c8 ignore start */
      } catch (_) {}
      /* c8 ignore stop */
    }
    try {
      // if it's a signal this system doesn't recognize, skip it
      process.on(sig, listener)
      listeners.set(sig, listener)
      /* c8 ignore start */
    } catch (_) {}
    /* c8 ignore stop */
  }

  return () => {
    for (const [sig, listener] of listeners) {
      process.removeListener(sig, listener)
    }
  }
}

const isPromise = (o: any): o is Promise<any> =>
  !!o && typeof o === 'object' && typeof o.then === 'function'
