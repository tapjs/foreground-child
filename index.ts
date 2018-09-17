import { ChildProcess, SpawnOptions } from "child_process";
import { Server, Socket } from "net";
import signalExit from "signal-exit";
// tslint:disable-next-line:no-var-requires
const spawn = process.platform === "win32" ? require("cross-spawn") : require("child_process").spawn;

function noop() {
}

interface ReadableStreamLike {
  pipe(destination: any, options?: any): any;

  unpipe(destination: any): any;
}

/**
 * Interface representing a parent process.
 *
 * This interface is compatible with the global variable `process`.
 */
interface ProcessLike {
  pid: number;
  stdout: any;
  stderr: any;
  stdin: ReadableStreamLike;

  exit(code?: number): any;

  on(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): any;

  on(signal: "message", listener: (message: any, sendHandle: Socket | Server) => void): any;

  on(signal: "exit", listener: NodeJS.ExitListener): any;

  removeListener(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): any;

  removeListener(signal: "message", listener: (message: any, sendHandle: Socket | Server) => void): any;

  removeListener(signal: "exit", listener: NodeJS.ExitListener): any;

  send?(message: any, sendHandle?: any): void;
}

/**
 * This function closes the parent process like the child process:
 * - If the child was killed by a signal, it kills the parent with this signal.
 * - If the child has exited, it exits the parent with the same return code.
 */
type CloseFn = () => void;

/**
 * Proxies `child` through `parent`.
 *
 * Any signal, IPC message or stream IO on the parent will be passed to the
 * child.
 * The returned promise is resolved once the child is closed.
 * The value is a close function to close the parent process the same way as
 * the child was closed.
 *
 * @param parent Parent process.
 * @param child Child process.
 * @return Close function to close the parent function like the child process.
 */
async function proxy(parent: ProcessLike, child: ChildProcess): Promise<CloseFn> {
  return new Promise<CloseFn>((resolve, reject) => {
    const unproxySignals: UnproxySignals = proxySignals(parent, child);
    const unproxyStreams: UnproxyStreams = proxyMessages(parent, child);
    const unproxyMessages: UnproxyMessages = proxyMessages(parent, child);

    parent.on("exit", onParentExit);
    child.on("close", onClose);

    function onParentExit() {
      child.kill("SIGHUP");
    }

    function onClose(code: number | null, signal: string | null) {
      unproxyMessages();
      unproxyStreams();
      unproxySignals();
      parent.removeListener("exit", onParentExit);
      resolve(() => {
        if (signal !== null) {
          if (parent === process) {
            // If there is nothing else keeping the event loop alive,
            // then there's a race between a graceful exit and getting
            // the signal to this process.  Put this timeout here to
            // make sure we're still alive to get the signal, and thus
            // exit with the intended signal code.
            setTimeout(noop, 200);
          }
          process.kill(parent.pid, signal);
        } else {
          parent.exit(code!);
        }
      });
    }
  });
}

/**
 * @internal
 */
type CloseHandler = (done: CloseFn) => any;

/**
 * @internal
 */
interface NormalizedArguments {
  readonly program: string;
  readonly args: ReadonlyArray<string>;
  readonly cb: CloseHandler;
}

/**
 * Normalizes the arguments passed to `foregroundChild`.
 *
 * See the signature of `foregroundChild` for the supported arguments.
 *
 * @param a Array of arguments passed to `foregroundChild`.
 * @return Normalized arguments
 * @internal
 */
function normalizeArguments(a: any[]): NormalizedArguments {
  let program: string;
  let args: ReadonlyArray<string>;
  let cb: CloseHandler;

  let processArgsEnd: number = a.length;
  const lastArg: any = a[a.length - 1];
  if (typeof lastArg === "function") {
    cb = lastArg;
    processArgsEnd--;
  } else {
    cb = (done: CloseFn) => done();
  }

  if (Array.isArray(a[0])) {
    [program, ...args] = a[0];
  } else {
    program = a[0];
    args = Array.isArray(a[1]) ? a[1] : a.slice(1, processArgsEnd);
  }

  return {program, args, cb};
}

// tslint:disable:max-line-length
function foregroundChild(program: string | ReadonlyArray<string>, cb?: CloseHandler): ChildProcess;
function foregroundChild(program: string, args: ReadonlyArray<string>, cb?: CloseHandler): ChildProcess;
function foregroundChild(program: string, arg1: string, cb?: CloseHandler): ChildProcess;
function foregroundChild(program: string, arg1: string, arg2: string, cb?: CloseHandler): ChildProcess;
function foregroundChild(program: string, arg1: string, arg2: string, arg3: string, cb?: CloseHandler): ChildProcess;
function foregroundChild(program: string, arg1: string, arg2: string, arg3: string, arg4: string, cb?: CloseHandler): ChildProcess;
// tslint:enable
function foregroundChild(...a: any[]): any {
  const {program, args, cb} = normalizeArguments(a);

  const spawnOpts: SpawnOptions = {
    stdio: process.send !== undefined ? [0, 1, 2, "ipc"] : [0, 1, 2],
  };

  const child: ChildProcess = spawn(program, args, spawnOpts);

  if (process.send !== undefined) {
    process.removeAllListeners("message");
  }
  const unproxySignals: UnproxySignals = proxySignals(process, child);
  const unproxyMessages: UnproxyMessages = proxyMessages(process, child);

  process.on("exit", childHangup);

  function childHangup() {
    child.kill("SIGHUP");
  }

  child.on("close", (code: number | null, signal: string | null) => {
    // Allow the callback to inspect the child’s exit code and/or modify it.
    process.exitCode = signal ? 128 + signal : code as any;

    cb(() => {
      unproxySignals();
      process.removeListener("exit", childHangup);
      if (signal) {
        // If there is nothing else keeping the event loop alive,
        // then there's a race between a graceful exit and getting
        // the signal to this process.  Put this timeout here to
        // make sure we're still alive to get the signal, and thus
        // exit with the intended signal code.
        setTimeout(noop, 200);
        process.kill(process.pid, signal);
      } else {
        // Equivalent to process.exit() on Node.js >= 0.11.8
        process.exit(process.exitCode);
      }
    });
  });

  return child;
}

/**
 * @internal
 */
type UnproxySignals = () => void;

/**
 * @internal
 */
function proxySignals(parent: ProcessLike, child: ChildProcess): UnproxySignals {
  const listeners: Map<NodeJS.Signals, NodeJS.SignalsListener> = new Map();

  for (const sig of signalExit.signals()) {
    const listener: NodeJS.SignalsListener = () => child.kill(sig);
    listeners.set(sig, listener);
    parent.on(sig, listener);
  }

  return unproxySignals;

  function unproxySignals(): void {
    for (const [sig, listener] of listeners) {
      parent.removeListener(sig, listener);
    }
  }
}

/**
 * @internal
 */
type UnproxyMessages = () => void;

/**
 * @internal
 */
function proxyMessages(parent: ProcessLike, child: ChildProcess): UnproxyMessages {
  if (parent.send === undefined) {
    return noop;
  }

  function childListener(message: any, sendHandle: Socket | Server): void {
    parent.send!(message, sendHandle);
  }

  function parentListener(message: any, sendHandle: Socket | Server): void {
    child.send(message, sendHandle);
  }

  child.on("message", childListener);
  parent.on("message", parentListener);

  return unproxySignals;

  function unproxySignals(): void {
    child.removeListener("message", childListener);
    parent.removeListener("message", parentListener);
  }
}

/**
 * @internal
 */
type UnproxyStreams = () => void;

/**
 * @internal
 */
function proxyStreams(parent: ProcessLike, child: ChildProcess): UnproxyStreams {
  if (typeof child.stdout === "object" && child.stdout !== null) {
    child.stdout.pipe(process.stdout);
  }
  if (typeof child.stderr === "object" && child.stderr !== null) {
    child.stderr.pipe(process.stderr);
  }
  if (typeof child.stdin === "object" && child.stdin !== null) {
    process.stdin.pipe(child.stdin);
  }

  return unproxyStreams;

  function unproxyStreams(): void {
    if (typeof child.stdout === "object" && child.stdout !== null) {
      child.stdout.unpipe(process.stdout);
    }
    if (typeof child.stderr === "object" && child.stderr !== null) {
      child.stderr.unpipe(process.stderr);
    }
    if (typeof child.stdin === "object" && child.stdin !== null) {
      process.stdin.unpipe(child.stdin);
    }
  }
}

// These TS exports are only there to generate the type definitions, they will be overwritten by the CJS exports below
export {
  CloseHandler,
  CloseFn,
  ProcessLike,
  ReadableStreamLike,
  proxy,
};

module.exports = foregroundChild;
Object.assign(module.exports, {
  proxy,
});
