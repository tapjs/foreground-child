import t from "tap";

const node = process.execPath;

switch (process.argv[2]) {
  case "child":
    child();
    break;
  case "parent":
    parent();
    break;
  case undefined:
    test();
}

function test() {
  if (process.platform === "win32") {
    t.plan(0, "skip on windows");
    return;
  }
  const spawn = require("child_process").spawn;
  const proc = spawn(node, [__filename, "parent"]);

  let out = "";
  proc.stdout.on("data", (c: Buffer) => out += c);

  let err = "";
  proc.stderr.on("data", (c: Buffer) => err += c);

  proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    clearTimeout(timer);
  });
  proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
    const actual = {out, err, code, signal};
    const expect = {
      out: /^(child alive\n)*child SIGINT received\n(child alive\n)*child exit null SIGTERM\n$/,
      err: /^parent \d+\nchild \d+\n$/,
      code: null,
      signal: "SIGTERM",
    };
    t.match(actual, expect);
    t.end();
  });

  let time = 500;
  // coverage slows things down a bit
  if (process.env._TAP_COVERAGE_) {
    time = 2000;
  }
  let timer = setTimeout(() => {
    proc.kill("SIGINT");
    timer = setTimeout(() => proc.kill("SIGTERM"), time);
  }, time);
}

function parent() {
  console.error("parent", process.pid);
  const fg = require("../");
  fg(node, [__filename, "child"]);
}

function child() {
  console.error("child", process.pid);
  setInterval(() => console.log("child alive"), 200);
  process.on("SIGINT", () => console.log("child SIGINT received"));
  process.on("SIGHUP", () => console.log("child SIGHUP received"));
  require("signal-exit")((code: number | null, signal: NodeJS.Signals | null) => {
    console.log("child exit", code, signal);
  });
}
