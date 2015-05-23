var fg = require('../index.js')
var spawn = require('child_process').spawn
var signalExit = require('signal-exit')

if (process.argv[2] === 'child') {
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
    process.exit(+process.argv[3])
    break
  }

  return
}

if (process.argv[2] === 'parent') {
  var program = process.execPath
  var args = [__filename, 'child'].concat(process.argv.slice(3))
  var child = fg(program, args)

  if (process.argv[3] === 'signalexit') {
    signalExit(function (code, signal) {
      console.log('parent exit')
    })
    switch (process.argv[4]) {
    case 'parent':
      process.kill(process.pid, 'SIGTERM')
      break
    case 'child':
      process.kill(child.pid, 'SIGTERM')
      break
    default:
      process.exit()
      break
    }
  }
  return
}

var t = require('tap')
t.test('signals', function (t) {
  var signals = [
    'SIGTERM',
    'SIGHUP',
    'SIGKILL'
  ]
  signals.forEach(function (sig) {
    t.test(sig, function (t) {
      t.plan(3)
      var prog = process.execPath
      var args = [__filename, 'parent', sig]
      var child = spawn(prog, args)
      var out = ''
      child.stdout.on('data', function (c) { out += c })
      child.on('close', function (code, signal) {
        t.equal(signal, sig)
        t.equal(code, null)
        t.equal(out, 'stdout\n')
      })
    })
  })
  t.end()
})

t.test('exit codes', function (t) {
  var codes = [0, 1, 2]
  codes.forEach(function (c) {
    t.test(c, function (t) {
      t.plan(3)
      var prog = process.execPath
      var args = [__filename, 'parent', c]
      var child = spawn(prog, args)
      var out = ''
      child.stdout.on('data', function (c) { out += c })
      child.on('close', function (code, signal) {
        t.equal(signal, null)
        t.equal(code, c)
        t.equal(out, 'stdout\n')
      })
    })
  })
  t.end()
})

t.test('parent emits exit when SIGTERMed', function (t) {
  var which = ['parent', 'child', 'nobody']
  which.forEach(function (who) {
    t.test('SIGTERM ' + who, function (t) {
      var prog = process.execPath
      var args = [__filename, 'parent', 'signalexit', who]
      var child = spawn(prog, args)
      var out = ''
      child.stdout.on('data', function (c) { out += c })
      child.on('close', function (code, signal) {
        if (who === 'nobody')
          t.equal(signal, null)
        else
          t.equal(signal, 'SIGTERM')
        t.equal(out, 'parent exit\n')
        t.end()
      })
    })
  })
  t.end()
})
