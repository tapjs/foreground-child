module.exports = function (program, args) {
  if (Array.isArray(program)) {
    args = program.slice(1)
    program = program[0]
  } else if (!Array.isArray(args)) {
    args = [].slice.call(arguments, 1)
  }

  var child = require('child_process').spawn(
    program,
    args,
    { stdio: 'inherit' }
  )

  signals.forEach(function (sig) {
    try {
      process.on(sig, function () {
        child.kill(sig)
      })
    } catch (er) {}
  })

  process.on('exit', function (code) {
    child.kill('SIGHUP')
  })

  child.on('close', function (code, signal) {
    if (signal) {
      process.removeAllListeners(signal)
      process.kill(process.pid, signal)
    } else {
      process.exit(code)
    }
  })

  return child
}

var signals = [
  'SIGABRT',
  'SIGALRM',
  'SIGBUS',
  'SIGCHLD',
  'SIGCLD',
  'SIGCONT',
  'SIGEMT',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINFO',
  'SIGINT',
  'SIGIO',
  'SIGIOT',
  'SIGKILL',
  'SIGLOST',
  'SIGPIPE',
  'SIGPOLL',
  'SIGPROF',
  'SIGPWR',
  'SIGQUIT',
  'SIGSEGV',
  'SIGSTKFLT',
  'SIGSTOP',
  'SIGSYS',
  'SIGTERM',
  'SIGTRAP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGUNUSED',
  'SIGURG',
  'SIGUSR1',
  'SIGUSR2',
  'SIGVTALRM',
  'SIGWINCH',
  'SIGXCPU',
  'SIGXFSZ'
]
