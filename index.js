const signalExit = require('signal-exit')
/* istanbul ignore next */
const spawn = process.platform === 'win32' ? require('cross-spawn') : require('child_process').spawn

function noop() {
}

/**
 * Normalizes the arguments passed to `foregroundChild`.
 *
 * See the signature of `foregroundChild` for the supported arguments.
 *
 * @param fgArgs Array of arguments passed to `foregroundChild`.
 * @return Normalized arguments
 * @internal
 */
function normalizeFgArgs(fgArgs) {
  let program, args, cb;
  let processArgsEnd = fgArgs.length;
  const lastFgArg = fgArgs[fgArgs.length - 1];
  if (typeof lastFgArg === "function") {
    cb = lastFgArg;
    processArgsEnd -= 1;
  } else {
    cb = (done) => done();
  }

  if (Array.isArray(fgArgs[0])) {
    [program, ...args] = fgArgs[0];
  } else {
    program = fgArgs[0];
    args = Array.isArray(fgArgs[1]) ? fgArgs[1] : fgArgs.slice(1, processArgsEnd);
  }

  return {program, args, cb};
}

/**
 *
 * Signatures:
 * ```
 * (program: string | string[], cb?: CloseHandler);
 * (program: string, args: string[], cb?: CloseHandler);
 * (program: string, ...args: string[], cb?: CloseHandler);
 * ```
 */
function foregroundChild (...fgArgs) {
  const {program, args, cb} = normalizeFgArgs(fgArgs);

  const spawnOpts = { stdio: [0, 1, 2] }

  if (process.send) {
    spawnOpts.stdio.push('ipc')
  }

  const child = spawn(program, args, spawnOpts)

  const unproxySignals = proxySignals(process, child)
  process.on('exit', childHangup)
  function childHangup () {
    child.kill('SIGHUP')
  }

  child.on('close', (code, signal) => {
    // Allow the callback to inspect the child’s exit code and/or modify it.
    process.exitCode = signal ? 128 + signal : code

    cb(() => {
      unproxySignals()
      process.removeListener('exit', childHangup)
      if (signal) {
        // If there is nothing else keeping the event loop alive,
        // then there's a race between a graceful exit and getting
        // the signal to this process.  Put this timeout here to
        // make sure we're still alive to get the signal, and thus
        // exit with the intended signal code.
        /* istanbul ignore next */
        setTimeout(function () {}, 200)
        process.kill(process.pid, signal)
      } else {
        process.exit(process.exitCode)
      }
    })
  })

  if (process.send) {
    process.removeAllListeners('message')
    proxyMessages(process, child)
  }

  return child
}

/**
 * Starts forwarding signals to `child` through `parent`.
 *
 * @param parent Parent process.
 * @param child Child Process.
 * @return `unproxy` function to stop the forwarding.
 * @internal
 */
function proxySignals (parent, child) {
  const listeners = new Map()

  for (const sig of signalExit.signals()) {
    const listener = () => child.kill(sig)
    listeners.set(sig, listener)
    parent.on(sig, listener)
  }

  return function unproxySignals () {
    for (const [sig, listener] of listeners) {
      parent.removeListener(sig, listener)
    }
  }
}

/**
 * Starts forwarding IPC messages to `child` through `parent`.
 *
 * @param parent Parent process.
 * @param child Child Process.
 * @return `unproxy` function to stop the forwarding.
 * @internal
 */
function proxyMessages(parent, child) {
  if (parent.send === undefined) {
    return noop
  }

  function childListener(message, handle) {
    parent.send(message, handle)
  }

  function parentListener(message, handle) {
    child.send(message, handle)
  }

  child.on('message', childListener)
  parent.on('message', parentListener)

  return unproxySignals;

  function unproxySignals() {
    child.removeListener('message', childListener)
    parent.removeListener('message', parentListener)
  }
}

module.exports = foregroundChild
