var node = process.execPath

if (process.argv[2] === 'child')
  child()
else if (process.argv[2] === 'parent')
  parent()
else
  test()

function test () {
  var t = require('tap')
  if (process.platform === 'win32') {
    t.plan(0, 'skip on windows')
    return
  }
  var spawn = require('child_process').spawn
  var proc = spawn(node, [__filename, 'parent'])

  var out = ''
  proc.stdout.on('data', function (c) { out += c })

  var err = ''
  proc.stderr.on('data', function (c) { err += c })

  proc.on('exit', function (code, signal) {
    clearTimeout(timer)
  })
  proc.on('close', function (code, signal) {
    var actual = {
      out: out,
      err: err,
      code: code,
      signal: signal
    }
    var expect = {
      out: /^(child alive\n)*child SIGINT received\n(child alive\n)*child exit null SIGTERM\n$/,
      err: /^parent \d+\nchild \d+\n$/,
      code: null,
      signal: 'SIGTERM'
    }
    t.match(actual, expect)
    t.end()
  })

  var time = 250
  // coverage slows things down a bit
  if (process.env._TAP_COVERAGE_)
    time = 1000
  var timer = setTimeout(function () {
    proc.kill('SIGINT')
    timer = setTimeout(function () {
      proc.kill('SIGTERM')
    }, time)
  }, time)
}

function parent () {
  console.error('parent', process.pid)
  var fg = require('../')
  fg(node, [ __filename, 'child' ])
}

function child () {
  console.error('child', process.pid)
  setInterval(function () {
    console.log('child alive')
  }, 200)
  process.on('SIGINT', function () {
    console.log('child SIGINT received')
  })
  process.on('SIGHUP', function () {
    console.log('child SIGHUP received')
  })
  require('signal-exit')(function (code, signal) {
    console.log('child exit', code, signal)
  })
}
