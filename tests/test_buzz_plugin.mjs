// The Buzz Desktop plugin (packages/buzz/openorange-buzz) run outside Buzz, with no Sunport and no network: a stand-in
// for the plugin context Buzz gives it (agents.register, agents.harness, host.spawn, as Buzz's plugin docs give them)
// starts the stubs beside this file wherever the plugin starts `oo`: the stub ACP agent for `oo acp`, and the stub
// `oo buzz hosted` for the always-on type's steps.
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
const HOSTED_STUB = fileURLToPath(new URL("hosted_stub.mjs", import.meta.url));
/** The stub each declared process starts. */
const STUBS = { oo: STUB, "oo-buzz": HOSTED_STUB };
const OWNER = "owner-pubkey";
const FIRST_TURN = "\n\n(Sent from Buzz, #general. Your reply is posted there as your message.)";

/** One Buzz profile on one computer: the plugin's storage, and the stub `oo` (or none) with its state. */
function computer(t, { installed = true, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "buzz-plugin-"));
  const file = join(dir, "acp-stub.json");
  const hostedFile = join(dir, "hosted-stub.json");
  const program = installed ? (id) => [process.execPath, STUBS[id]] : () => [join(dir, "oo")];
  const stored = new Map();
  const runs = [];
  t.after(async () => {
    for (const buzz of runs) await buzz.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    /** What the stub `oo` was started with and received, or nothing when no `oo` started. */
    stub: () => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined),
    /** Each `oo buzz hosted` call's arguments and input, and the agents made, or nothing when none ran. */
    hostedStub: () => (existsSync(hostedFile) ? JSON.parse(readFileSync(hostedFile, "utf8")) : undefined),
    /** The Sunport no longer has this session. */
    forget(session) {
      const state = JSON.parse(readFileSync(file, "utf8"));
      delete state.sessions[session];
      writeFileSync(file, JSON.stringify(state));
    },
    /** Buzz starting with the plugin turned on. */
    start() {
      globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => void stored.set(key, value) };
      const buzz = run(program, { ...env, ACP_STUB_STATE: file, HOSTED_STUB_STATE: hostedFile });
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
  const types = [];
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
      const [command, ...first] = program(id);
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
        end: (data = "") => new Promise((resolve, reject) => child.stdin.end(data, (error) => (error ? reject(error) : resolve()))),
        kill: async () => void child.kill("SIGTERM"),
        exited,
      };
    },
  };
  plugin.apply({
    agents: { harness: kit, register: (registered) => types.push(registered) },
    host,
    effect: (start) => cleanups.push(start()),
  });
  let stopped;
  return {
    types,
    type: types.find((registered) => registered.id === "agent"),
    hosted: types.find((registered) => registered.id === "hosted"),
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

// The always-on type. Buzz calls its steps with these, each with the community connection's signal.
const COMMUNITY = "wss://community.example";
const PICTURE = "https://pictures.example/clem.png";
/** The owner's proof that the agent is theirs, as Buzz hands it to activate. */
const AUTH = ["auth", OWNER, "kind=9", "owner-signature"];
const HOSTED = ["buzz", "hosted"];
const signal = () => new AbortController().signal;
const until = async (done) => {
  for (let waited = 0; !done() && waited < 100; waited++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(done());
};

test("registers the always-on type beside the local one: hosted, with its five steps and no run", (t) => {
  const here = computer(t);
  const { types, type, hosted } = here.start();
  assert.deepEqual(
    types.map((registered) => [registered.id, registered.title]),
    [
      ["agent", "OpenOrange"],
      ["hosted", "OpenOrange (always on)"],
    ],
  );
  // What Buzz requires of a hosted type.
  assert.deepEqual(Object.keys(hosted.remote).sort(), ["activate", "interrupt", "profile", "provision", "remove"]);
  for (const step of Object.values(hosted.remote)) assert.equal(typeof step, "function");
  assert.equal(hosted.run, undefined);
  assert.equal(hosted.models, undefined);
  assert.equal(hosted.timeoutMs, undefined);
  assert.deepEqual(hosted.defaults(), { config: {} });
  // The local type is as it was.
  assert.equal(typeof type.run, "function");
  assert.equal(type.timeoutMs, 30 * 60_000);
  assert.equal(type.remote, undefined);
  // Registering starts no oo.
  assert.equal(here.hostedStub(), undefined);
});

test("provision hands oo the community, name and picture, and gives Buzz the key with the picture it was made with", async (t) => {
  const here = computer(t);
  const { remote } = here.start().hosted;
  const made = await remote.provision({ name: "Clem", picture: PICTURE, community: COMMUNITY, config: {}, signal: signal() });
  const plain = await remote.provision({ name: "Scout", community: COMMUNITY, config: {}, signal: signal() });
  const { calls, agents } = here.hostedStub();
  assert.deepEqual(calls, [
    { args: [...HOSTED, "provision"], input: { community: COMMUNITY, name: "Clem", picture: PICTURE } },
    { args: [...HOSTED, "provision"], input: { community: COMMUNITY, name: "Scout" } },
  ]);
  assert.match(made.pubkey, /^[0-9a-f]{64}$/);
  assert.deepEqual(made, { pubkey: agents[`${COMMUNITY} Clem`].pubkey, picture: PICTURE });
  assert.deepEqual(plain, { pubkey: agents[`${COMMUNITY} Scout`].pubkey });
});

test("a repeated provision, as Buzz retries one, returns the same agent", async (t) => {
  const here = computer(t);
  const { remote } = here.start().hosted;
  const input = { name: "Clem", picture: PICTURE, community: COMMUNITY };
  const first = await remote.provision({ ...input, signal: signal() });
  const again = await remote.provision({ ...input, signal: signal() });
  assert.deepEqual(again, first);
  const { calls, agents } = here.hostedStub();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(Object.keys(agents).length, 1);
});

test("activate hands oo the owner's proof and waits for the sign-in in the browser, however long it takes", async (t) => {
  // Longer than the 5 s Buzz gives a declared command.
  const here = computer(t, { env: { HOSTED_STUB: JSON.stringify({ activate: { wait: 6000 } }) } });
  const { remote } = here.start().hosted;
  const started = Date.now();
  const input = { pubkey: "a".repeat(64), name: "Clem", community: COMMUNITY };
  assert.equal(await remote.activate({ ...input, auth: AUTH, config: {}, signal: signal() }), undefined);
  assert.ok(Date.now() - started >= 6000);
  assert.deepEqual(here.hostedStub().calls, [{ args: [...HOSTED, "activate"], input: { ...input, auth: AUTH } }]);
});

test("a step that fails shows the owner oo's reason", async (t) => {
  const reason = "You did not finish signing in to Buzz. Choose Finish setup to try again.";
  const steps = { activate: { fail: reason }, remove: { exit: 3 }, profile: { answer: "Done." } };
  const { remote } = computer(t, { env: { HOSTED_STUB: JSON.stringify(steps) } }).start().hosted;
  const agent = { pubkey: "a".repeat(64), community: COMMUNITY };
  // Its last line on stderr, after its progress.
  await assert.rejects(remote.activate({ ...agent, name: "Clem", auth: AUTH, signal: signal() }), { message: reason });
  await assert.rejects(remote.remove({ ...agent, signal: signal() }), { message: "oo stopped without saying why." });
  await assert.rejects(remote.profile({ ...agent, name: "Clem", signal: signal() }), {
    message: "oo's answer could not be read. Update oo with `oo update`, then try again.",
  });
});

test("when Buzz stops waiting, oo is ended; a step Buzz no longer waits for starts none", async (t) => {
  const here = computer(t, { env: { HOSTED_STUB: JSON.stringify({ activate: { hang: true } }) } });
  const buzz = here.start();
  const controller = new AbortController();
  const input = { pubkey: "a".repeat(64), name: "Clem", community: COMMUNITY, auth: AUTH };
  const activating = buzz.hosted.remote.activate({ ...input, signal: controller.signal });
  await until(() => here.hostedStub()?.calls.length === 1);
  assert.equal(buzz.running(), 1);
  controller.abort();
  await assert.rejects(activating, { name: "AbortError" });
  await until(() => buzz.running() === 0);

  await assert.rejects(buzz.hosted.remote.provision({ name: "Clem", community: COMMUNITY, signal: controller.signal }), { name: "AbortError" });
  assert.equal(here.hostedStub().calls.length, 1);
});

test("profile, remove and interrupt hand oo what Buzz names, in oo's words", async (t) => {
  const here = computer(t);
  const { remote } = here.start().hosted;
  const agent = { pubkey: "a".repeat(64), community: COMMUNITY };
  assert.equal(await remote.profile({ ...agent, name: "Clementine", picture: PICTURE, signal: signal() }), undefined);
  assert.equal(await remote.remove({ ...agent, signal: signal() }), undefined);
  assert.equal(await remote.interrupt({ ...agent, channelId: "channel-1", threadRootId: "root-1", signal: signal() }), true);
  assert.deepEqual(here.hostedStub().calls, [
    { args: [...HOSTED, "profile"], input: { ...agent, name: "Clementine", picture: PICTURE } },
    { args: [...HOSTED, "remove"], input: agent },
    { args: [...HOSTED, "interrupt"], input: { ...agent, channel: "channel-1", root: "root-1" } },
  ]);

  const idle = computer(t, { env: { HOSTED_STUB: JSON.stringify({ interrupt: { stopped: false } }) } }).start().hosted;
  assert.equal(await idle.remote.interrupt({ ...agent, channelId: "channel-1", threadRootId: "root-1", signal: signal() }), false);
});

test("without oo on the computer, an always-on agent's setup says to install it", async (t) => {
  const here = computer(t, { installed: false });
  const { remote } = here.start().hosted;
  await assert.rejects(remote.provision({ name: "Clem", community: COMMUNITY, signal: signal() }), {
    message:
      "The oo command was not found on this computer. Install it from your Sunport (Connect, then Command line), run `oo login`, and try again.",
  });
  assert.equal(here.hostedStub(), undefined);
});
