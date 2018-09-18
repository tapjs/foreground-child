import cp from "child_process";
import path from "path";
import signalExit from "signal-exit";
import t from "tap";
import * as fg from "../index";

function noop() {
}

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
  setTimeout(noop, 1000);
  console.log("stdout");
  setTimeout(noop, 1000);
  switch (process.argv[3]) {
    case "SIGTERM":
    case "SIGHUP":
    case "SIGKILL":
      process.kill(process.pid, process.argv[3]);
      setTimeout(noop, 100);
      break;

    case "0":
    case "1":
    case "2":
      process.exit(+process.argv[3]);
      break;

    case "ipc1":
    case "ipc2":
    case "ipc3":
      process.on("message", (m) => {
        console.log("message received");
        process.send!(m);
        process.exit(0);
      });
      break;
  }
}

function parentMain() {
  let options: fg.SpawnOptions | undefined;
  switch (process.argv[3]) {
    case "hello": {
      const fileName = process.platform === "win32" ? "hello.cmd" : "hello.sh";
      const file = path.join(__dirname, "executable", fileName);
      fg.spawn(file).close.then((close) => close());
      break;
    }
    case "hello2": {
      const fileName = process.platform === "win32" ? "hello.cmd" : "hello.sh";
      const file = path.join(__dirname, "executable", fileName);
      fg.spawn(file, [], {spawn: cp.spawn, parent: process})
        .close.then((close) => close());
      break;
    }
    case "ipc2":
      options = {stdio: ["inherit", "inherit", "inherit"]};
      break;
    case "ipc3":
      options = {stdio: ["inherit", "inherit", "inherit", "ipc"]};
      break;
  }

  let cb: fg.CloseHandler | undefined;

  // we can optionally assign a beforeExit handler
  // to the foreground-child process; we should test it.
  if (process.argv[4] === "beforeExitHandler") {
    cb = (done: fg.CloseFn) => {
      const expectedExitCode = parseInt(process.argv[3], 10);
      if (expectedExitCode !== done.code) {
        console.log("unexpected exit code", expectedExitCode, done.code);
      }

      console.log("beforeExitHandler");
      return done();
    };
  } else {
    cb = (done: fg.CloseFn) => done();
  }

  const program = process.execPath;
  const args = [__filename, "child"].concat(process.argv.slice(3));
  const {child, close} = fg.spawn(program, args, options);
  close.then(cb);

  if (process.argv[3] === "signalexit") {
    signalExit((code, signal) => {
      console.log("parent exit");
    });
    switch (process.argv[4]) {
      case "parent":
        process.kill(process.pid, "SIGTERM");
        break;
      case "child":
        process.kill(child.pid, "SIGTERM");
        break;
      default:
        process.exit();
        break;
    }
  }
}

function test() {
  t.test("signals", {skip: winSignals()}, (t: any): void => {
    const signals = [
      "SIGTERM",
      "SIGHUP",
      "SIGKILL",
    ];
    for (const sig of signals) {
      t.test(sig, (t: any): void => {
        t.plan(3);
        const prog = process.execPath;
        const args = [__filename, "parent", sig];
        const child = cp.spawn(prog, args);
        let out = "";
        child.stdout.on("data", (c) => out += c);
        child.on("close", (code, signal) => {
          t.equal(signal, sig);
          t.equal(code, null);
          t.equal(out, "stdout\n");
        });
      });
    }
    t.end();
  });

  t.test("exit codes", (t: any): void => {
    const codes = [0, 1, 2];
    for (const c of codes) {
      t.test(c, (t: any): void => {
        t.plan(3);
        const prog = process.execPath;
        const args = [__filename, "parent", c.toString()];
        const child = cp.spawn(prog, args);
        let out = "";
        child.stdout.on("data", (c) => out += c);
        child.on("close", (code, signal) => {
          t.equal(signal, null);
          t.equal(code, c);
          t.equal(out, "stdout\n");
        });
      });
    }
    t.end();
  });

  t.test("parent emits exit when SIGTERMed", {skip: winSignals()}, (t: any): void => {
    const which = ["parent", "child", "nobody"];
    for (const who of which) {
      t.test("SIGTERM " + who, (t: any): void => {
        const prog = process.execPath;
        const args = [__filename, "parent", "signalexit", who];
        const child = cp.spawn(prog, args);
        let out = "";
        child.stdout.on("data", (c) => out += c);
        child.on("close", (code, signal) => {
          if (who === "nobody") {
            t.equal(signal, null);
          } else {
            t.equal(signal, "SIGTERM");
          }
          t.equal(out, "parent exit\n");
          t.end();
        });
      });
    }
    t.end();
  });

  t.test("beforeExitHandler", (t: any): void => {
    const codes = [0, 1, 2];
    codes.forEach((c) => {
      t.test(c, (t: any): void => {
        t.plan(3);
        const prog = process.execPath;
        const args = [__filename, "parent", c.toString(10), "beforeExitHandler"];
        const child = cp.spawn(prog, args);
        let out = "";
        child.stdout.on("data", (c) => out += c);
        child.on("close", (code, signal) => {
          t.equal(signal, null);
          t.equal(code, c);
          t.equal(out, "stdout\nbeforeExitHandler\n");
        });
      });
    });
    t.end();
  });

  t.test("IPC forwarding", (t: any): void => {
    for (const ipcKind of ["ipc1", "ipc2", "ipc3"]) {
      t.test(ipcKind, (t: any) => {
        t.plan(5);
        const prog = process.execPath;
        const args = [__filename, "parent", ipcKind];
        const child = cp.spawn(prog, args, {stdio: ["ipc", "pipe", "pipe"]});
        let out = "";
        const messages: any[] = [];
        child.on("message", (m) => messages.push(m));
        child.stdout.on("data", (c) => out += c);

        child.send({data: "foobar"});
        child.on("close", (code, signal) => {
          t.equal(signal, null);
          t.equal(code, 0);
          t.equal(out, "stdout\nmessage received\n");
          t.equal(messages.length, 1);
          t.equal(messages[0].data, "foobar");
        });
      });
    }
    t.end();
  });

  t.test("spawn(`hello`)", (t: any): void => {
    t.plan(3);
    const prog = process.execPath;
    const args = [__filename, "parent", "hello"];
    const child = cp.spawn(prog, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c) => chunks.push(c));

    child.on("close", (code, signal) => {
      const out: string = Buffer.concat(chunks).toString("UTF-8");
      t.equal(code, 0);
      t.equal(signal, null);
      t.equal(out, "Hello, World!\n");
    });
  });

  t.test("spawn(`hello`, [], {spawn: cp.spawn, parent: process})", (t: any): void => {
    t.plan(3);
    const prog = process.execPath;
    const args = [__filename, "parent", "hello2"];
    const child = cp.spawn(prog, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (c) => chunks.push(c));

    child.on("close", (code, signal) => {
      const out: string = Buffer.concat(chunks).toString("UTF-8");
      t.equal(code, 0);
      t.equal(signal, null);
      t.equal(out, "Hello, World!\n");
    });
  });

  t.end();
}

function winSignals() {
  return process.platform === "win32" ?
    "windows does not support unix signals" : false;
}
