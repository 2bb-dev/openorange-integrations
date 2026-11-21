// A stand-in for `oo acp` with no Sunport behind it: the Agent Client Protocol as `oo acp` speaks it, one JSON-RPC
// message per line on stdin and stdout. Its sessions and every message it receives are kept in the file named by
// ACP_STUB_STATE, so a test can read them and a stub started after a restart resumes the sessions an earlier one made.
// Each turn answers "Turn <n> of <session>." in two chunks. A prompt asking to "count slowly" shows a tool call and runs
// until session/cancel. ACP_STUB_REFUSE='{"method": …, "message": …}' answers that method with a JSON-RPC error.
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const file = process.env.ACP_STUB_STATE;
const refuse = JSON.parse(process.env.ACP_STUB_REFUSE || "null");
let state;
try {
  state = JSON.parse(readFileSync(file, "utf8"));
} catch {
  state = { starts: [], received: [], sessions: {}, made: 0 };
}
const save = () => writeFileSync(file, JSON.stringify(state));
state.starts.push(process.argv.slice(2));
save();

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
const update = (sessionId, change) => send({ method: "session/update", params: { sessionId, update: change } });
const text = (sessionId, words) => update(sessionId, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: words } });
const unknown = (id) => send({ id, error: { code: -32602, message: "Session not found" } });
/** The prompt of each session that runs until it is cancelled. */
const running = new Map();

createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method, params = {} } = JSON.parse(line);
  state.received.push({ method, params });
  save();
  if (method === refuse?.method) return send({ id, error: { code: -32000, message: refuse.message } });
  if (method === "initialize")
    return send({ id, result: { protocolVersion: 1, agentCapabilities: { loadSession: true }, authMethods: [] } });
  if (method === "session/new") {
    const sessionId = `session-${++state.made}`;
    state.sessions[sessionId] = 0;
    save();
    return send({ id, result: { sessionId } });
  }
  if (method === "session/resume") return params.sessionId in state.sessions ? send({ id, result: {} }) : unknown(id);
  if (method === "session/prompt") {
    const { sessionId } = params;
    if (!(sessionId in state.sessions)) return unknown(id);
    const turn = ++state.sessions[sessionId];
    save();
    if (/count slowly/.test(params.prompt?.[0]?.text ?? "")) {
      update(sessionId, { sessionUpdate: "tool_call", toolCallId: "count", title: "Counting", status: "in_progress" });
      return running.set(sessionId, id);
    }
    text(sessionId, `Turn ${turn} `);
    text(sessionId, `of ${sessionId}.`);
    return send({ id, result: { stopReason: "end_turn" } });
  }
  if (method === "session/cancel") {
    if (running.has(params.sessionId)) send({ id: running.get(params.sessionId), result: { stopReason: "cancelled" } });
    return running.delete(params.sessionId);
  }
  if (id !== undefined) send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
});
