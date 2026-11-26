// A stand-in for `oo buzz hosted <step>` with no Sunport behind it: the step's input as one JSON object on stdin, its
// answer as one on stdout, or a line of progress and then the reason on stderr and exit 1. Each call (its arguments and
// input) and the agents made are kept in the file named by HOSTED_STUB_STATE, so a test can read them and a later call
// finds the agents an earlier one made: provision answers a repeat with the same agent. HOSTED_STUB='{"<step>": …}'
// changes a step: "wait" (milliseconds before it answers), "hang" (never answers, until it is ended), "fail" (the
// reason it fails with), "exit" (a code it exits with, saying nothing), "answer" (raw text in place of its answer),
// "stopped" (interrupt's answer; true by default).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const file = process.env.HOSTED_STUB_STATE;
const args = process.argv.slice(2);
const step = args.at(-1);
const how = JSON.parse(process.env.HOSTED_STUB || "{}")[step] ?? {};
let state;
try {
  state = JSON.parse(readFileSync(file, "utf8"));
} catch {
  state = { calls: [], agents: {} };
}
const save = () => writeFileSync(file, JSON.stringify(state));

let stdin = "";
process.stdin.setEncoding("utf8");
for await (const data of process.stdin) stdin += data;
const input = JSON.parse(stdin);
state.calls.push({ args, input });
save();

if (how.hang) setInterval(() => undefined, 60_000);
else {
  await new Promise((resolve) => setTimeout(resolve, how.wait ?? 0));
  if (how.fail) {
    process.stderr.write(`Working on ${step}…\n${how.fail}\n`);
    process.exit(1);
  }
  if (how.exit) process.exit(how.exit);
  let answer = {};
  if (step === "provision") {
    const key = `${input.community} ${input.name}`;
    state.agents[key] ??= {
      id: `agent-${Object.keys(state.agents).length + 1}`,
      pubkey: createHash("sha256").update(key).digest("hex"),
    };
    save();
    answer = state.agents[key];
  } else if (step === "activate") answer = { state: "active" };
  else if (step === "interrupt") answer = { stopped: how.stopped ?? true };
  process.stdout.write(how.answer ?? `${JSON.stringify(answer)}\n`);
}
