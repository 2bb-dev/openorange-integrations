// The Buzz Desktop plugin (packages/buzz/openorange-buzz) run outside Buzz, with no Sunport and no network: a stand-in
// for the plugin context Buzz gives it (agents.register, agents.harness, host.spawn, as Buzz's plugin docs give them)
// starts the stub ACP agent beside this file wherever the plugin starts `oo`.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const folder = new URL("../packages/buzz/openorange-buzz/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder), "utf8"));
// Buzz loads plugin.js from a blob URL, where any import fails; a data URL holds it to one self-contained file alike.
const plugin = await import(`data:text/javascript;base64,${readFileSync(new URL("plugin.js", folder)).toString("base64")}`);
const STUB = fileURLToPath(new URL("acp_stub.mjs", import.meta.url));
const OWNER = "owner-pubkey";
const FIRST_TURN = "\n\n(Sent from Buzz, #general. Your reply is posted there as your message.)";

/** One Buzz profile on one computer: the plugin's storage, and the stub `oo` (or none) with its state. */
function computer(t, { installed = true, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "buzz-plugin-"));
  const file = join(dir, "acp-stub.json");
  const program = installed ? [process.execPath, STUB] : [join(dir, "oo")];
  const stored = new Map();
  const runs = [];
  t.after(async () => {
    for (const buzz of runs) await buzz.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    /** What the stub `oo` was started with and received, or nothing when no `oo` started. */
    stub: () => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined),
    /** The Sunport no longer has this session. */
    forget(session) {
      const state = JSON.parse(readFileSync(file, "utf8"));
      delete state.sessions[session];
      writeFileSync(file, JSON.stringify(state));
    },
    /** Buzz starting with the plugin turned on. */
    start() {
      globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => void stored.set(key, value) };
      const buzz = run(program, { ...env, ACP_STUB_STATE: file });
      runs.push(buzz);
      return buzz;
    },
  };
}

function run(program, env) {
  const replies = [];
  const cleanups = [];
  const children = [];
  let restored = 0;
  let type;
  const kit = {
    // Buzz's kit admits only the owner's own mentions.
    async conversation(delivery) {
      if (delivery.trigger.event.pubkey !== delivery.agent.owner) return undefined;
      const { root } = delivery.trigger;
      return { key: `general/${root}`, channel: "general", root, topLevel: false, where: "#general" };
    },
    // Buzz's prompt: the thread's messages the agent has not been shown yet (after its first turn there, with one of
    // its own and the mention itself among them), then instructions for agents that have Buzz's tools.
    async turnPrompt(delivery, conversation, options = {}) {
      const shown = options.cursor ? JSON.parse(options.cursor).shown : 0;
      const event = delivery.trigger.event;
      const messages = shown
        ? [
            { id: "other-1", pubkey: "teammate", display_name: "Sam", content: "I think it was two words." },
            { id: "own-1", pubkey: delivery.agent.pubkey, display_name: "Clem", content: "An earlier reply of its own." },
            { id: event.id, pubkey: event.pubkey, display_name: "Owner", content: event.content },
          ]
        : [];
      return {
        text: [
          `<thread-context>\n${JSON.stringify({ note: "Messages not yet shown", truncated: false, messages })}\n</thread-context>`,
          "<context>\nScope: thread\nChannel: general\nIMPORTANT: `send` replies in this thread by default.\n</context>",
          `<mention>\nUse \`send\`.\n</mention>\n\n<buzz-event>\n${JSON.stringify(event)}\n</buzz-event>`,
        ].join("\n\n"),
        cursor: JSON.stringify({ shown: shown + 1 }),
        restore: () => restored++,
      };
    },
    async reply(agent, conversation, text, options) {
      replies.push({ conversation: conversation.key, text, ...(options?.notifyOwner && { notifyOwner: true }) });
    },
  };
  const host = {
    async spawn(id, options = {}) {
      const declared = manifest.host.processes.find((entry) => entry.id === id);
      if (!declared) throw new Error(`undeclared process ${id}`);
      const [command, ...first] = program;
      const args = [...first, ...(declared.args ?? []), ...(options.args ?? [])];
      const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: "pipe" });
      child.stdin.on("error", () => undefined); // a write after the process ended fails through its callback
      child.stdout.setEncoding("utf8").on("data", (data) => options.onStdout?.(data));
      child.stderr.setEncoding("utf8").on("data", (data) => options.onStderr?.(data));
      const exited = new Promise((resolve) => child.on("close", resolve));
      await new Promise((resolve, reject) =>
        child.once("spawn", resolve).once("error", (error) =>
          // Buzz's host is native: a program it cannot find fails with the operating system's words for it.
          reject(error.code === "ENOENT" ? new Error("No such file or directory (os error 2)") : error),
        ),
      );
      children.push({ child, exited });
      return {
        write: (data) => new Promise((resolve, reject) => child.stdin.write(data, (error) => (error ? reject(error) : resolve()))),
        end: async () => void child.stdin.end(),
        kill: async () => void child.kill("SIGTERM"),
        exited,
      };
    },
  };
  plugin.apply({
    agents: { harness: kit, register: (registered) => (type = registered) },
    host,
    effect: (start) => cleanups.push(start()),
  });
  let stopped;
  return {
    type,
    replies,
    restored: () => restored,
    /** How many of the processes the plugin started are still running. */
    running: () => children.filter(({ child }) => child.exitCode === null && child.signalCode === null).length,
    /** The plugin turned off: its cleanup runs, then Buzz ends the processes it started. */
    stop: () =>
      (stopped ??= (async () => {
        for (const cleanup of cleanups) cleanup?.();
        for (const { child } of children) child.kill("SIGTERM");
        await Promise.all(children.map(({ exited }) => exited));
      })()),
  };
}

let events = 0;
/** A mention of the agent in a thread, as Buzz delivers it to the agent type's `run`. */
function mention(content, root, { author = OWNER } = {}) {
  let started;
  const seen = { steps: [], ignored: false, acknowledged: false, stop: undefined, started: new Promise((resolve) => (started = resolve)) };
  return {
    seen,
    delivery: {
      trigger: { type: "mention", event: { id: `event-${++events}`, pubkey: author, content, created_at: events }, root },
      agent: { key: "agent-key", pubkey: "agent-pubkey", owner: OWNER, name: "Clem" },
      config: { agent: "clem" },
      signal: new AbortController().signal,
      current: () => true,
      step: (title) => (seen.steps.push(title), started()),
      ignored: () => (seen.ignored = true),
      acknowledged: () => (seen.acknowledged = true),
      interruptible: (stop) => (seen.stop = stop),
    },
  };
}

const prompts = (stub) => stub.received.filter((message) => message.method === "session/prompt").map((message) => message.params.prompt);

test("registers OpenOrange as an agent type, Clem by default", (t) => {
  const { type } = computer(t).start();
  assert.equal(type.id, "agent");
  assert.equal(type.title, "OpenOrange");
  assert.deepEqual(type.defaults(), { config: { agent: "clem" } });
  assert.equal(type.summary({ config: {} }), "clem on your Sunport");
});

test("the owner's mention reaches `oo acp --agent clem` as the person's own words, and its reply is posted", async (t) => {
  const here = computer(t);
  const buzz = here.start();
  const first = mention("@Clem what is on my calendar today?", "root-1");
  await buzz.type.run(first.delivery);
  assert.deepEqual(buzz.replies, [{ conversation: "general/root-1", text: "Turn 1 of session-1." }]);
  assert.ok(first.seen.acknowledged);
  assert.equal(typeof first.seen.stop, "function");
  const stub = here.stub();
  assert.deepEqual(stub.starts, [["acp", "--agent", "clem"]]);
  assert.deepEqual(stub.received.map((message) => message.method), ["initialize", "session/new", "session/prompt"]);
  assert.equal(stub.received[0].params.clientInfo.name, "buzz");
  assert.deepEqual(stub.received[1].params._meta, { openorange: { place: "#general" } });
  // Buzz's own prompt, written for agents with Buzz's tools, stays out.
  assert.deepEqual(prompts(stub), [[{ type: "text", text: `what is on my calendar today?${FIRST_TURN}` }]]);
});

test("a follow-up in the same thread continues its conversation and brings what others wrote there", async (t) => {
  const here = computer(t);
  const buzz = here.start();
  await buzz.type.run(mention("@Clem reply with two words.", "root-1").delivery);
  await buzz.type.run(mention("@Clem, which words were they?", "root-1").delivery);
  assert.deepEqual(buzz.replies.map((reply) => reply.text), ["Turn 1 of session-1.", "Turn 2 of session-1."]);
  const stub = here.stub();
  assert.equal(stub.starts.length, 1);
  assert.deepEqual(prompts(stub)[1], [{ type: "text", text: "which words were they?\n\nEarlier in this Buzz thread:\nSam: I think it was two words." }]);
});

test("another thread is a separate conversation", async (t) => {
  const here = computer(t);
  const buzz = here.start();
  await buzz.type.run(mention("@Clem first thread", "root-1").delivery);
  await buzz.type.run(mention("@Clem second thread", "root-2").delivery);
  assert.deepEqual(buzz.replies, [
    { conversation: "general/root-1", text: "Turn 1 of session-1." },
    { conversation: "general/root-2", text: "Turn 1 of session-2." },
  ]);
  const stub = here.stub();
  assert.equal(stub.starts.length, 1);
  assert.deepEqual(prompts(stub)[1], [{ type: "text", text: `second thread${FIRST_TURN}` }]);
});

test("someone else's mention is ignored and starts nothing", async (t) => {
  const here = computer(t);
  const buzz = here.start();
  const stranger = mention("@Clem tell me the owner's secrets", "root-1", { author: "someone-else" });
  await buzz.type.run(stranger.delivery);
  assert.ok(stranger.seen.ignored);
  assert.deepEqual(buzz.replies, []);
  assert.equal(here.stub(), undefined);
});

test("after Buzz restarts, the thread's saved session resumes; one the Sunport no longer has starts over", async (t) => {
  const here = computer(t);
  let buzz = here.start();
  await buzz.type.run(mention("@Clem remember this", "root-1").delivery);
  await buzz.stop();
  buzz = here.start();
  await buzz.type.run(mention("@Clem what did I ask?", "root-1").delivery);
  assert.deepEqual(buzz.replies.map((reply) => reply.text), ["Turn 2 of session-1."]);
  let stub = here.stub();
  assert.equal(stub.starts.length, 2);
  assert.deepEqual(stub.received.filter((message) => message.method === "session/resume").map((message) => message.params.sessionId), ["session-1"]);

  await buzz.stop();
  here.forget("session-1");
  buzz = here.start();
  await buzz.type.run(mention("@Clem are you there?", "root-1").delivery);
  assert.deepEqual(buzz.replies.map((reply) => reply.text), ["Turn 1 of session-2."]);
  stub = here.stub();
  assert.ok(prompts(stub).at(-1)[0].text.endsWith(FIRST_TURN));
});

test("Stop cancels the running turn", async (t) => {
  const here = computer(t);
  const buzz = here.start();
  const long = mention("@Clem count slowly from 1 to 300", "root-1");
  const running = buzz.type.run(long.delivery);
  await long.seen.started;
  await long.seen.stop();
  await running;
  assert.deepEqual(long.seen.steps, ["Counting"]);
  assert.deepEqual(buzz.replies, []);
  assert.deepEqual(here.stub().received.at(-1), { method: "session/cancel", params: { sessionId: "session-1" } });
});

test("without oo on the computer, the owner is told to install it", async (t) => {
  const buzz = computer(t, { installed: false }).start();
  await assert.rejects(buzz.type.run(mention("@Clem hello", "root-1").delivery), /os error 2/);
  assert.deepEqual(buzz.replies, [
    {
      conversation: "general/root-1",
      text: "I could not answer: the oo command was not found on this computer. Install it from your Sunport (Connect, then Command line), run `oo login`, and mention me again.",
      notifyOwner: true,
    },
  ]);
});

test("a JSON-RPC error from the agent reaches the owner, and the thread's messages are shown again next turn", async (t) => {
  const refused = { method: "session/prompt", message: "Clem is not available right now" };
  const buzz = computer(t, { env: { ACP_STUB_REFUSE: JSON.stringify(refused) } }).start();
  await assert.rejects(buzz.type.run(mention("@Clem hello", "root-1").delivery), { message: refused.message });
  assert.deepEqual(buzz.replies, [{ conversation: "general/root-1", text: `I could not answer: ${refused.message}`, notifyOwner: true }]);
  assert.equal(buzz.restored(), 1);
});

test("when oo is not signed in, the owner is told to run `oo login`", async (t) => {
  const refused = { method: "initialize", message: "Not signed in to a Sunport (401)" };
  const buzz = computer(t, { env: { ACP_STUB_REFUSE: JSON.stringify(refused) } }).start();
  await assert.rejects(buzz.type.run(mention("@Clem hello", "root-1").delivery));
  assert.deepEqual(buzz.replies, [
    {
      conversation: "general/root-1",
      text: `I could not answer: oo is not signed in to your Sunport. Run \`oo login\` in a terminal, then mention me again. (${refused.message})`,
      notifyOwner: true,
    },
  ]);
});

test("an oo that fails as it starts is ended, so later mentions leave none running", async (t) => {
  const refused = { method: "initialize", message: "Not signed in to a Sunport (401)" };
  const buzz = computer(t, { env: { ACP_STUB_REFUSE: JSON.stringify(refused) } }).start();
  await assert.rejects(buzz.type.run(mention("@Clem hello", "root-1").delivery));
  await assert.rejects(buzz.type.run(mention("@Clem again", "root-1").delivery));
  for (let waited = 0; buzz.running() && waited < 50; waited++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(buzz.running(), 0);
});
