var fg = require('../index.js')
var spawn = require('child_process').spawn
var signalExit = require('signal-exit')

switch (process.argv[2]) {
  case "child":
    childMain();
    break;
  case "parent":
    parentMain();
    break;
  default:
    test();
}

function childMain() {
  console.log(JSON.stringify(process.argv.slice(3)));
}

function parentMain() {
  const fgArgs = JSON.parse(process.argv[3]);
  fg(...fgArgs);
}

// function foregroundChild(program: string | ReadonlyArray<string>, cb?: CloseHandler): ChildProcess;
// function foregroundChild(program: string, args: ReadonlyArray<string>, cb?: CloseHandler): ChildProcess;
// function foregroundChild(program: string, arg1: string, cb?: CloseHandler): ChildProcess;
// function foregroundChild(program: string, arg1: string, arg2: string, cb?: CloseHandler): ChildProcess;
// function foregroundChild(program: string, arg1: string, arg2: string, arg3: string, cb?: CloseHandler): ChildProcess;
// function foregroundChild(program: string, arg1: string, arg2: string, arg3: string, arg4: string, cb?: CloseHandler): ChildProcess;
// // tslint:enable
// function foregroundChild(...a: any[]): any {

function test () {
  var t = require('tap')

  t.test('fg(process.execPath, [__filename, "child"])', function (t) {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, [__filename, "child"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = [];
      t.match(actual, expected)
    });
  });

  t.test('fg(process.execPath, [__filename, "child", "foo"])', function (t) {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, [__filename, "child", "foo"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["foo"];
      t.match(actual, expected)
    });
  });

  t.test('fg([process.execPath, __filename, "child", "bar"])', function (t) {
    t.plan(1);
    const fgArgs = JSON.stringify([[process.execPath, __filename, "child", "bar"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["bar"];
      t.match(actual, expected)
    });
  });

  t.test('fg(process.execPath, __filename, "child", "baz")', function (t) {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, __filename, "child", "baz"]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["baz"];
      t.match(actual, expected)
    });
  });

  t.end()
}

function winSignals () {
  return process.platform === 'win32' ?
    'windows does not support unix signals' : false
}
