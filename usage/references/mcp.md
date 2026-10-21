# MCP: tasks and conversations

The packaged hosted connection starts a free trial Sunport (an OpenOrange
server) through the assistant's normal connection controls and browser consent.
No OpenOrange account is needed to try it. Discovery alone does not start a
trial; the browser Connect action controls consent and allocation, subject to
availability. The agent handles text tasks with web search only: no files,
commands or Sunport changes, Clem included.

This connection can resume an available saved Sunport retained through the same
hosted flow. It cannot attach an unrelated existing Sunport. If the user asks to
work with an existing Sunport outside this flow, do not start a trial instead:
use the separately installed and signed-in CLI, or that Sunport's separately
configured own connector where supported. Its toolset is distinct; follow its
actual tool descriptions. Selected files and other Sunport actions use the CLI.

| Tool | Purpose |
| --- | --- |
| `whoami` | Check the connected Sunport and access expiry; get the optional Keep link |
| `list_agents` | Find the agents available to this connection |
| `ask_agent` | Send a task or a follow-up in an existing conversation |
| `get_result` | Read the status and result of an accepted task |

## Send and follow a task

Check `whoami` first. Use the returned Sunport identity (its `sunport` field;
older servers return it as `workspace`) to confirm the user's chosen Sunport.
If it differs from an existing conversation's Sunport, stop and reconnect to
the intended Sunport before using its IDs.

Use `list_agents`; each row contains `id`, `display_name` and `status`. Keep the
user's named or previously selected agent when available; otherwise select from
the returned agents without inventing ability profiles or specialist rankings.
Use its returned `id` as `agent_id` in `ask_agent` and `get_result`. Send the
requested `message` once. Omit `thread_id` for a new conversation; include its
previously returned value for a follow-up. A follow-up returns a **new `run_id`**
to check in that same conversation. If used, `wait_seconds` must be an integer
from 1 to 25; it limits the wait, not the task's lifetime. A wait timeout does
not cancel the task.

For a completed response, show the returned answer. For a running task, retain
`agent_id`, `thread_id`, and `run_id`, and call `get_result` with those values.
Report a running, failed, or aborted task accurately. Do not treat an error or
missing identifiers as completion. Do not resend a message to check its result.

These tools do not list earlier conversations or cancel tasks. If a send was
interrupted before returning task IDs, report that acceptance is uncertain
rather than sending it again automatically.

## Keep and reconnect

When the user asks to keep an available trial or complete pending retention,
check `whoami` and show its returned `keep_url`. The user opens that link in
the original browser, signs in to OpenOrange and chooses **Keep this Sunport**.
Reading or returning the link does not keep the trial. Check `whoami` again;
retention is complete only when both `trial` and `retention_pending` are false.

Continue with the same conversation IDs after keeping the Sunport. Keeping
it does not refresh the assistant's connection. If the connection expires,
reconnect through the assistant's controls in the original browser, signed in
to the owning account, or use **Sign in to a saved Sunport** when offered.
Only available retained connections from this hosted flow are eligible; this
is not a picker for unrelated existing Sunports. Confirm the same `whoami`
identity before continuing with its original IDs. Report unavailable or expired
access without promising recovery, creating a replacement trial or extending
saved access. Start another trial only when the user requests that new flow.

Use the assistant's Disconnect control when requested. Disconnecting does not
delete Sunport data. Never request passwords or sign-in codes in tool input
or chat. Share only task-relevant content and results.
