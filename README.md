# foreground-child

[![Build Status](https://travis-ci.org/tapjs/foreground-child.svg)](https://travis-ci.org/tapjs/foreground-child) [![Build status](https://ci.appveyor.com/api/projects/status/kq9ylvx9fyr9khx0?svg=true)](https://ci.appveyor.com/project/isaacs/foreground-child)

Run a child as if it's the foreground process. Give it stdio.

Mostly this module is here to support some use cases around wrapping
child processes for test coverage and such.

## USAGE

```js
const fg = require('foreground-child')

// cats out this file
const {child, close} = fg('cat', [__filename])

// At this point, it's best to just do nothing else.
// return or whatever.
// If the child gets a signal, or just exits, then this
// parent process will exit in the same way.

// Close is a promise resolved when the child is closed.
// You can use it to inspected its exit code and exit the parent process.
close.then((close) => {
  // You can use this handler to perform an action before exiting the
  // foreground child.
  console.log(close.code);
  console.log(close.status);
  close(); // Kills the parent process using the result of the child process.
});

```

## Caveats

The "normal" standard IO file descriptors (0, 1, and 2 for stdin,
stdout, and stderr respectively) are shared with the child process.
Additionally, if there is an IPC channel set up in the parent, then
messages are proxied to the child on file descriptor 3.

However, in Node, it's possible to also map arbitrary file descriptors
into a child process.  In these cases, foreground-child will not map
the file descriptors into the child.  If file descriptors 0, 1, or 2
are used for the IPC channel, then strange behavior may happen (like
printing IPC messages to stderr, for example).

Note that a SIGKILL will always kill the parent process, _and never
the child process_, because SIGKILL cannot be caught or proxied.  The
only way to do this would be if Node provided a way to truly exec a
process as the new foreground program in the same process space,
without forking a separate child process.

## API

The canonical documentation is in the source code. See [index.ts](./index.ts).

- `fg(file, args)`: Original API
- `fg.compat`: Alias for `fg`.
- `fg.spawn(file, args, options)`: New API, based on Node's `cp.spawn`.
- `fg.proxy(parent, child)`: Forward IO, IPC and signals from parent to child.
