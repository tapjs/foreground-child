var signalExit = require('signal-exit')
var spawn = require('child_process').spawn
if (process.platform === 'win32') {
  spawn = require('cross-spawn')
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
  var program, args, cb;
  var processArgsEnd = fgArgs.length;
  var lastFgArg = fgArgs[fgArgs.length - 1];
  if (typeof lastFgArg === "function") {
    cb = lastFgArg;
    processArgsEnd -= 1;
  } else {
    cb = function(done) { done(); };
  }

  if (Array.isArray(fgArgs[0])) {
    program = fgArgs[0][0];
    args = fgArgs[0].slice(1);
  } else {
    program = fgArgs[0];
    args = Array.isArray(fgArgs[1]) ? fgArgs[1] : fgArgs.slice(1, processArgsEnd);
  }

  return {program: program, args: args, cb: cb};
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
module.exports = function (/* program, args, cb */) {
  var fgArgs = normalizeFgArgs([].slice.call(arguments, 0));
  var program = fgArgs.program;
  var args = fgArgs.args;
  var cb = fgArgs.cb;

  var spawnOpts = { stdio: [0, 1, 2] }

  if (process.send) {
    spawnOpts.stdio.push('ipc')
  }

  var child = spawn(program, args, spawnOpts)

  var childExited = false
  var unproxySignals = proxySignals(child)
  process.on('exit', childHangup)
  function childHangup () {
    child.kill('SIGHUP')
  }

  child.on('close', function (code, signal) {
    // Allow the callback to inspect the child’s exit code and/or modify it.
    process.exitCode = signal ? 128 + signal : code

    cb(function () {
      unproxySignals()
      process.removeListener('exit', childHangup)
      childExited = true
      if (signal) {
        // If there is nothing else keeping the event loop alive,
        // then there's a race between a graceful exit and getting
        // the signal to this process.  Put this timeout here to
        // make sure we're still alive to get the signal, and thus
        // exit with the intended signal code.
        setTimeout(function () {}, 200)
        process.kill(process.pid, signal)
      } else {
        // Equivalent to process.exit() on Node.js >= 0.11.8
        process.exit(process.exitCode)
      }
    })
  })

  if (process.send) {
    process.removeAllListeners('message')

    child.on('message', function (message, sendHandle) {
      process.send(message, sendHandle)
    })

    process.on('message', function (message, sendHandle) {
      child.send(message, sendHandle)
    })
  }

  return child
}

function proxySignals (child) {
  var listeners = {}
  signalExit.signals().forEach(function (sig) {
    listeners[sig] = function () {
      child.kill(sig)
    }
    process.on(sig, listeners[sig])
  })

  return unproxySignals

  function unproxySignals () {
    for (var sig in listeners) {
      process.removeListener(sig, listeners[sig])
    }
  }
}

/**
 * Starts forwarding standard IO (stdin, stdout, stderr) to `child` through `parent`.
 *
 * @param parent Parent process.
 * @param child Child Process.
 * @return `unproxy` function to stop the forwarding.
 * @internal
 */
function proxyStdio(parent, child) {
  if (typeof child.stdin === 'object' && child.stdin !== null) {
    parent.stdin.pipe(child.stdin)
  }
  if (typeof child.stdout === 'object' && child.stdout !== null) {
    child.stdout.pipe(parent.stdout)
  }
  if (typeof child.stderr === 'object' && child.stderr !== null) {
    child.stderr.pipe(parent.stderr)
  }

  return unproxyStdio;

  function unproxyStdio() {
    if (typeof child.stdin === 'object' && child.stdin !== null) {
      parent.stdin.unpipe(child.stdin)
    }
    if (typeof child.stdout === 'object' && child.stdout !== null) {
      child.stdout.unpipe(parent.stdout)
    }
    if (typeof child.stderr === 'object' && child.stderr !== null) {
      child.stderr.unpipe(parent.stderr)
    }
  }
}
