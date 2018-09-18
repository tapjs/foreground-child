import childProcess from "child_process";
import stream from "stream";
import t from "tap";
import * as fg from "../index";

const NODE = process.execPath;

function noop() {
}

interface LogEntry {
  type: string;
  data: any;
}

class MockProcess implements fg.ProcessLike {
  pid: number;
  stdout: stream.Duplex;
  stderr: stream.Duplex;
  stdin: stream.Duplex;

  logs: LogEntry[];
  private exitListeners: NodeJS.ExitListener[];

  constructor(pid: number) {
    this.pid = pid;
    this.stdout = new stream.PassThrough();
    this.stderr = new stream.PassThrough();
    this.stdin = new stream.PassThrough();

    this.stdout.on("data", (chunk) => this.log("stdout", chunk));
    this.stderr.on("data", (chunk) => this.log("stderr", chunk));

    this.logs = [];
    this.exitListeners = [];
  }

  exit(code: number) {
    this.log("exit", {code});
    for (const listener of this.exitListeners) {
      try {
        listener(code);
      } catch (err) {
      }
    }
  }

  kill(pid: number, signal: NodeJS.Signals) {
    this.log("kill", {pid, signal});
  }

  on(event: string, listener: any) {
    this.log(`addListener:${event}`);
    if (event === "exit") {
      this.exitListeners.push(listener);
    }
  }

  removeListener(event: string, listener: any) {
    this.log(`removeListener:${event}`);
    if (event === "exit") {
      this.exitListeners = this.exitListeners.filter((l) => l !== listener);
    }
  }

  send(message: any, handle?: any): void {
    this.log("send", {message, handle});
  }

  log(type: string, data?: any): void {
    this.logs.push({type, data});
  }
}

switch (process.argv[2]) {
  case "child":
    child();
    break;
  case undefined:
    test();
    break;
}

function child() {
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
      process.exit(parseInt(process.argv[3], 10));
      break;

    case "echo":
      const chunks: Buffer[] = [];
      process.stdin.on("data", (chunk) => {
        chunks.push(chunk);
        const stdin = Buffer.concat(chunks).toString("UTF-8");
        const nlIndex = stdin.indexOf("\n");
        if (nlIndex >= 0) {
          console.error(stdin.substr(0, nlIndex));
          process.exit(0);
        }
      });
      break;
  }
}

function test() {
  t.test("signals", {skip: winSignals()}, (t: any) => {
    const signals = [
      "SIGTERM",
      "SIGHUP",
      "SIGKILL",
    ];
    for (const sig of signals) {
      t.test(sig, async (t: any) => {
        t.plan(1);
        const args = [__filename, "child", sig];
        const parent = new MockProcess(1);
        const child = childProcess.spawn(NODE, args);
        const close = await fg.proxy(parent, child);
        close();
        t.match(
          parent.logs.filter(({type}) => type === "kill"),
          [{type: "kill", data: {pid: 1, signal: sig}}],
        );
      });
    }
    t.end();
  });

  t.test("exit codes", (t: any) => {
    const codes = [0, 1, 2];
    for (const c of codes) {
      t.test(c, async (t: any) => {
        t.plan(1);
        const args = [__filename, "child", c.toString(10)];
        const parent = new MockProcess(1);
        const child = childProcess.spawn(NODE, args);
        const close = await fg.proxy(parent, child);
        close();
        t.match(
          parent.logs.filter(({type}) => type === "exit"),
          [{type: "exit", data: {code: c}}],
        );
      });
    }
    t.end();
  });

  t.test("streams", (t: any) => {
    t.test("echo", async (t: any) => {
      t.plan(2);
      const args = [__filename, "child", "echo"];
      const parent = new MockProcess(1);
      const child = childProcess.spawn(NODE, args);
      const closePromise = fg.proxy(parent, child);
      parent.stdin.write("Hello, World!\n");
      const close = await closePromise;
      close();
      t.match(
        parent.logs.filter(({type}) => type === "stdout"),
        [{type: "stdout", data: Buffer.from("stdout\n")}],
      );
      t.match(
        parent.logs.filter(({type}) => type === "stderr"),
        [{type: "stderr", data: Buffer.from("Hello, World!\n")}],
      );
    });
    t.test("Direct streams`", async (t: any) => {
      t.plan(1);
      const args = [__filename, "child"];
      const parent = new MockProcess(1);
      const child = childProcess.spawn(NODE, args);
      // Simulate a cp created using the parent streams directly (stdio: [0, 1, 2]).
      Object.assign(child, {stdin: null, stdout: null, stderr: null});
      const closePromise = fg.proxy(parent, child);
      parent.stdin.write("Hello, World!\n");
      const close = await closePromise;
      close();
      t.match(
        parent.logs.filter(({type}) => type === "stdout"),
        [],
      );
    });
    t.end();
  });

  t.test("`parent.exit` kills its child", {skip: winSignals()}, async (t: any) => {
    t.plan(2);
    const args = [__filename, "child", "echo"];
    const parent = new MockProcess(1);
    const child = childProcess.spawn(NODE, args);
    let killArgs;
    const oldKill = child.kill;
    // tslint:disable-next-line:only-arrow-functions space-before-function-paren
    child.kill = function (...args) {
      killArgs = args;
      child.kill = oldKill;
      child.kill(...args);
    };

    const closePromise = fg.proxy(parent, child);
    parent.exit(3);
    const close = await closePromise;
    close();
    t.match(
      parent.logs.filter(({type}) => type === "exit"),
      [{type: "exit", data: {code: 3}}],
    );
    t.match(killArgs, ["SIGHUP"]);
    t.end();
  });
}

function winSignals() {
  return process.platform === "win32" ?
    "windows does not support unix signals" : false;
}
