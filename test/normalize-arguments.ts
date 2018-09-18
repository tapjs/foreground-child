import childProcess from "child_process";
import t from "tap";
import { compat as fg } from "../index";

const spawn = childProcess.spawn;

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
  (fg as any)(...fgArgs);
}

function test() {
  t.test("fg(process.execPath, [__filename, \"child\"])", (t: any): void => {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, [__filename, "child"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected: ReadonlyArray<string> = [];
      t.match(actual, expected);
    });
  });

  t.test("fg(process.execPath, [__filename, \"child\", \"foo\"])", (t: any): void => {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, [__filename, "child", "foo"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected: ReadonlyArray<string> = ["foo"];
      t.match(actual, expected);
    });
  });

  t.test("fg([process.execPath, __filename, \"child\", \"bar\"])", (t: any): void => {
    t.plan(1);
    const fgArgs = JSON.stringify([[process.execPath, __filename, "child", "bar"]]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["bar"];
      t.match(actual, expected);
    });
  });

  t.test("fg(process.execPath, __filename, \"child\", \"baz\")", (t: any): void => {
    t.plan(1);
    const fgArgs = JSON.stringify([process.execPath, __filename, "child", "baz"]);
    const args = [__filename, "parent", fgArgs];
    const child = spawn(process.execPath, args);
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.once("close", () => {
      const actual = JSON.parse(Buffer.concat(chunks).toString("UTF-8"));
      const expected = ["baz"];
      t.match(actual, expected);
    });
  });

  t.end();
}
