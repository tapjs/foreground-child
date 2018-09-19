var fg = require('../index.js')
var spawn = require('child_process').spawn

switch (process.argv[2]) {
  case "child":
    childMain();
    break;
  case "parent":
    parentMain();
    break;
  case undefined:
    test();
    break;
}

function childMain() {
  console.log(JSON.stringify(process.argv.slice(3)));
}

function parentMain() {
  const fgArgs = JSON.parse(process.argv[3]);
  fg.apply(null, fgArgs);
}

function test () {
  var t = require('tap')

  t.test('fg(process.execPath, [__filename, "child"])', function (t) {
    t.plan(3);
    var fgArgs = JSON.stringify([process.execPath, [__filename, "child"]]);
    var args = [__filename, "parent", fgArgs];
    var child = spawn(process.execPath, args);
    var chunks = [];
    child.stdout.on("data", function(chunk) {chunks.push(chunk)});
    child.once("close", function(code, signal) {
      t.equal(code, 0)
      t.equal(signal, null)
      var actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      var expected = [];
      t.match(actual, expected)
    });
  });

  t.test('fg(process.execPath, [__filename, "child", "foo"])', function (t) {
    t.plan(3);
    var fgArgs = JSON.stringify([process.execPath, [__filename, "child", "foo"]]);
    var args = [__filename, "parent", fgArgs];
    var child = spawn(process.execPath, args);
    var chunks = [];
    child.stdout.on("data", function(chunk) {chunks.push(chunk)});
    child.once("close", function(code, signal) {
      t.equal(code, 0)
      t.equal(signal, null)
      var actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      var expected = ["foo"];
      t.match(actual, expected)
    });
  });

  t.test('fg([process.execPath, __filename, "child", "bar"])', function (t) {
    t.plan(3);
    var fgArgs = JSON.stringify([[process.execPath, __filename, "child", "bar"]]);
    var args = [__filename, "parent", fgArgs];
    var child = spawn(process.execPath, args);
    var chunks = [];
    child.stdout.on("data", function(chunk) {chunks.push(chunk)});
    child.once("close", function(code, signal) {
      t.equal(code, 0)
      t.equal(signal, null)
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["bar"];
      t.match(actual, expected)
    });
  });

  t.test('fg(process.execPath, __filename, "child", "baz")', function (t) {
    t.plan(3);
    const fgArgs = JSON.stringify([process.execPath, __filename, "child", "baz"]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks = [];
    child.stdout.on("data", function(chunk) {chunks.push(chunk)});
    child.once("close", function(code, signal) {
      t.equal(code, 0)
      t.equal(signal, null)
      var actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      var expected = ["baz"];
      t.match(actual, expected)
    });
  });

  t.end()
}
