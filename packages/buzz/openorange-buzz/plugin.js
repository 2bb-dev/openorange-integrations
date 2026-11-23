// OpenOrange in Buzz: an agent type whose agents are the owner's agents on their Sunport, Clem unless the agent's
// config names another. Buzz keeps the agent's identity and posts its replies. Each thread the agent is mentioned in is
// one continuing conversation with the Sunport's agent, reached through `oo acp` (the Agent Client Protocol on stdin
// and stdout), which signs in as the person who ran `oo login`. Nothing of the agent runs on this computer, and no key
// of Buzz's ever reaches `oo`.
export const inject = ["agents", "host"];

const TYPE_ID = "agent";
/** The Sunport agent a Buzz agent is, when its config names none. */
const DEFAULT_AGENT = "clem";
const SAVED = "openorange.agents.sessions.v1";
const SAVED_LIMIT = 500;
export function apply(ctx) {
  const { agents, host } = ctx;
  // Only the desktop app can start `oo`.
  if (!host.spawn) return;
  const kit = agents.harness;
  if (!kit) throw new Error("This Buzz cannot run agents a plugin brings yet. Update Buzz, then turn this plugin on again.");
  const bridges = createBridges(host.spawn.bind(host));
  const saved = createSaved(globalThis.localStorage);
  const turns = new Map();
  ctx.effect(() => () => bridges.stop());

  agents.register({
    id: TYPE_ID,
    title: "OpenOrange",
    description:
      "An agent of your OpenOrange Sunport, Clem by default, reached with oo on this computer. Each thread it is mentioned in is one continuing conversation.",
    defaults: () => ({ config: { agent: DEFAULT_AGENT } }),
    summary: (agent) => `${sunportAgent(agent.config)} on your Sunport`,
    timeoutMs: 30 * 60_000,
    run: (delivery) => {
      // One turn at a time for an agent: its next mention waits for the one it is answering.
      const key = delivery.agent.key;
      const next = (turns.get(key) ?? Promise.resolve()).then(() => turn(delivery, kit, bridges, saved));
      const settled = next.catch(() => undefined);
      turns.set(key, settled);
      void settled.then(() => turns.get(key) === settled && turns.delete(key));
      return next;
    },
  });
}

/** The Sunport agent a Buzz agent's config names: an id or alias `oo acp --agent` takes. */
function sunportAgent(config) {
  const named = typeof config?.agent === "string" ? config.agent.trim() : "";
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(named) ? named : DEFAULT_AGENT;
}

async function turn(delivery, kit, bridges, saved) {
  const { agent, signal } = delivery;
  const target = sunportAgent(delivery.config);
  const conversation = await kit.conversation(delivery, "thread");
  if (!conversation) {
    delivery.ignored?.();
    return;
  }
  if (!delivery.current()) return;
  const key = `${agent.key}|${target}|${conversation.key}`;
  let prompt;
  try {
    const acp = await bridges.connect(target);
    let kept = saved.get(key);
    if (kept && !acp.open.has(kept.session)) {
      try {
        await acp.request("session/resume", { sessionId: kept.session, cwd: "/", mcpServers: [] });
        acp.open.add(kept.session);
      } catch {
        kept = undefined; // archived or gone on the Sunport: start over, shown the conversation again
      }
    }
    let session = kept?.session;
    if (!session) {
      // Where the conversation is, for the Sunport to show beside it.
      const place = { _meta: { openorange: { place: conversation.where } } };
      session = (await acp.request("session/new", { cwd: "/", mcpServers: [], ...place })).sessionId;
      acp.open.add(session);
    }
    prompt = await kit.turnPrompt(delivery, conversation, kept?.cursor ? { cursor: kept.cursor } : {});
    signal.throwIfAborted();
    if (!delivery.current()) {
      prompt.restore();
      return;
    }
    let text = "";
    acp.updates.set(session, (update) => {
      if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") text += update.content.text;
      else if (update.sessionUpdate === "tool_call") delivery.step?.(String(update.title || update.kind || "tool"));
      else if (update.sessionUpdate === "session_info_update" && update.title) delivery.named?.(String(update.title));
    });
    const stop = () => acp.notify("session/cancel", { sessionId: session });
    signal.addEventListener("abort", stop, { once: true });
    delivery.interruptible?.(stop);
    delivery.acknowledged?.();
    let result;
    try {
      result = await acp.request("session/prompt", {
        sessionId: session,
        prompt: [{ type: "text", text: message(delivery, conversation, prompt.text, !kept) }],
      });
    } finally {
      signal.removeEventListener("abort", stop);
      acp.updates.delete(session);
    }
    saved.set(key, { session, cursor: prompt.cursor });
    const reply = text.trim();
    if (reply) await kit.reply(agent, conversation, reply);
    else if (result?.stopReason !== "cancelled") await kit.reply(agent, conversation, "I finished this turn without a reply.");
  } catch (error) {
    prompt?.restore();
    if (signal.aborted) throw error;
    await kit
      .reply(agent, conversation, `I could not answer: ${explain(error)}`, { notifyOwner: true })
      .catch(() => undefined);
    throw error;
  }
}

/** What the agent is sent for a turn, and so what its conversation on the Sunport shows: the person's own words, then
 * anything others wrote in the thread since the agent last saw it, and on a conversation's first turn where it is from.
 * Buzz's own prompt is written for agents with Buzz's tools, so only its unseen messages are taken from it. */
function message(delivery, conversation, prompt, first) {
  const { trigger, agent } = delivery;
  const event = trigger.type === "mention" ? trigger.event : undefined;
  // A wake has no message of a person's: Buzz's text for it is all there is.
  if (!event) return prompt;
  const said = saidTo(event.content, agent.name) || "(mentioned you without a message)";
  const earlier = unseen(prompt, agent.pubkey, event.id);
  return [
    said,
    earlier.length ? `Earlier in this Buzz thread:\n${earlier.join("\n")}` : "",
    first ? `(Sent from Buzz, ${conversation.where}. Your reply is posted there as your message.)` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A mention's text without the agent's own name at its start. */
function saidTo(content, name) {
  let text = String(content ?? "").trim();
  const own = `@${name}`.toLowerCase();
  while (text.toLowerCase().startsWith(own)) text = text.slice(own.length).replace(/^[\s,:]+/, "");
  return text.trim();
}

/** The messages Buzz's prompt lists as not yet shown, as "name: text" lines, without the agent's own. */
function unseen(prompt, own, current) {
  const found = /<(thread-context|conversation-context)>\n([\s\S]*?)\n<\/\1>/.exec(prompt);
  if (!found) return [];
  try {
    const messages = JSON.parse(found[2]).messages;
    return (Array.isArray(messages) ? messages : [])
      .filter((item) => item && item.pubkey !== own && item.id !== current && typeof item.content === "string" && item.content.trim())
      .map((item) => `${item.display_name || item.name || "Someone"}: ${item.content.trim()}`);
  } catch {
    return [];
  }
}

/** What to tell the owner when a turn fails. */
function explain(error) {
  const message = String(error?.message ?? error).trim();
  if (/os error 2|no such file|not found/i.test(message))
    return "the oo command was not found on this computer. Install it from your Sunport (Connect, then Command line), run `oo login`, and mention me again.";
  if (/not signed in|login|credential|unauthori[sz]ed|\b401\b/i.test(message))
    return `oo is not signed in to your Sunport. Run \`oo login\` in a terminal, then mention me again. (${message.slice(0, 300)})`;
  return message.slice(0, 600) || "oo stopped without saying why.";
}

/** One `oo acp` for each Sunport agent in use. */
function createBridges(spawn) {
  const made = new Map();
  return {
    connect(target) {
      if (!made.has(target)) made.set(target, createBridge(spawn, target));
      return made.get(target).connect();
    },
    stop() {
      for (const bridge of made.values()) bridge.stop();
    },
  };
}

/** One `oo acp` for every conversation with a Sunport agent, started when first needed and again after it exits. */
function createBridge(spawn, target) {
  let connection;
  let starting;
  let stopped = false;

  async function start() {
    const pending = new Map();
    const updates = new Map();
    const open = new Set();
    let ids = 0;
    let buffered = "";
    let errors = "";
    let ended;
    let process;
    const write = (message) => process.write(`${JSON.stringify(message)}\n`);

    const read = (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.id !== undefined && message.method === undefined) {
        const waiting = pending.get(message.id);
        pending.delete(message.id);
        if (!waiting) return;
        if (message.error) waiting.reject(new Error(message.error.message || "oo refused the request"));
        else waiting.resolve(message.result);
      } else if (message.method === "session/update") {
        updates.get(message.params?.sessionId)?.(message.params.update ?? {});
      } else if (message.id !== undefined) {
        // A request of oo's own, such as an approval: this plugin shows none, so the agent is told it was not given.
        void write({ jsonrpc: "2.0", id: message.id, result: { outcome: { outcome: "cancelled" } } }).catch(() => undefined);
      }
    };

    process = await spawn("oo", {
      args: ["--agent", target],
      onStdout: (data) => {
        buffered += data;
        for (let at = buffered.indexOf("\n"); at >= 0; at = buffered.indexOf("\n")) {
          const line = buffered.slice(0, at).trim();
          buffered = buffered.slice(at + 1);
          if (line) read(line);
        }
      },
      onStderr: (data) => {
        errors = (errors + data).slice(-1200);
      },
    });
    const request = (method, params) =>
      new Promise((resolve, reject) => {
        if (ended) return reject(ended);
        const id = ++ids;
        pending.set(id, { resolve, reject });
        write({ jsonrpc: "2.0", id, method, params }).catch((error) => {
          pending.delete(id);
          reject(error);
        });
      });
    const notify = (method, params) => write({ jsonrpc: "2.0", method, params }).catch(() => undefined);
    const self = { request, notify, updates, open, kill: () => process.kill() };
    void Promise.resolve(process.exited)
      .catch(() => undefined)
      .then(() => {
        ended = new Error(errors.trim().split("\n").pop() || "oo stopped");
        if (connection === starting) connection = undefined;
        for (const waiting of pending.values()) waiting.reject(ended);
        pending.clear();
      });
    try {
      await request("initialize", {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: "buzz", title: "Buzz", version: "1" },
      });
    } catch (error) {
      // An oo that can't start is of no use, and the next mention starts another: end this one.
      void process.kill().catch(() => undefined);
      throw error;
    }
    return self;
  }

  return {
    connect() {
      if (stopped) return Promise.reject(new Error("The OpenOrange plugin was turned off"));
      if (!connection) {
        const mine = start();
        starting = mine;
        connection = mine;
        mine.catch(() => {
          if (connection === mine) connection = undefined;
        });
      }
      return connection;
    },
    stop() {
      stopped = true;
      const last = connection;
      connection = undefined;
      void last?.then((acp) => acp.kill()).catch(() => undefined);
    },
  };
}

/** Each conversation's session on the Sunport and what it has been shown, kept on this computer. */
function createSaved(storage) {
  const load = () => {
    try {
      const value = JSON.parse(storage?.getItem(SAVED) ?? "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  return {
    get(key) {
      const found = load()[key];
      return typeof found?.session === "string" ? found : undefined;
    },
    set(key, value) {
      const all = load();
      delete all[key];
      all[key] = value;
      const kept = Object.fromEntries(Object.entries(all).slice(-SAVED_LIMIT));
      try {
        storage?.setItem(SAVED, JSON.stringify(kept));
      } catch {
        // Without storage, a restart starts each conversation over.
      }
    },
  };
}
