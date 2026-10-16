# MCP: tasks and conversations

Connect OpenOrange through your assistant's normal connection controls and
approve access in the browser. This connection supports text tasks in the
Sunport it identifies. The agent answers them with web search only: no files,
commands or changes in the Sunport, Clem included. Selected files and other
Sunport actions use the separate CLI workflow.

| Tool | Purpose |
| --- | --- |
| `whoami` | Check the connected Sunport and access status |
| `list_agents` | Find the agents available to this connection |
| `ask_agent` | Send a task or a follow-up in an existing conversation |
| `get_result` | Read the status and result of an accepted task |

## Send and follow a task

Check `whoami` first. Use the returned Sunport identity (its `sunport` field;
older servers return it as `workspace`) to confirm the user's chosen Sunport.
If it differs from an existing conversation's Sunport, stop and reconnect to
the intended Sunport before using its IDs.

Use `list_agents` and select an actual returned `agent_id`. Call `ask_agent`
with that ID and the requested `message`. Omit `thread_id` for a new conversation;
include its previously returned value for a follow-up. If used, `wait_seconds`
must be an integer from 1 to 25; it limits the wait, not the task's lifetime.

For a completed response, show the returned answer. For a running task, retain
`agent_id`, `thread_id`, and `run_id`, and call `get_result` with those values.
Report a running, failed, or aborted task accurately. Do not treat an error or
missing identifiers as completion. Do not resend a message to check its result.

These tools do not list earlier conversations or cancel tasks. If a send was
interrupted before returning task IDs, report that acceptance is uncertain
rather than sending it again automatically.

## Keep and reconnect

When the user asks to keep an available trial Sunport, check `whoami` and
show its returned `keep_url`. The user opens that link, signs in to OpenOrange,
and chooses **Keep this Sunport**. Check `whoami` again; retention is complete
only when both `trial` and `retention_pending` are false.

Continue with the same conversation IDs after keeping the Sunport. Keeping
it does not refresh the assistant's connection. If the connection expires,
reconnect through the assistant's controls, sign in to the owning account, and
select the intended saved Sunport when offered. Confirm `whoami` before
continuing. Report unavailable or expired access without promising recovery.

Use the assistant's Disconnect control when requested. Disconnecting does not
delete Sunport data. Never request passwords or sign-in codes in tool input
or chat. Share only task-relevant content and results.
