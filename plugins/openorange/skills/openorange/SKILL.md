---
name: openorange
description: Use OpenOrange's hosted trial MCP connection or the installed oo CLI for a chosen Sunport. Use when the user asks to try OpenOrange, delegate a task, read or continue an agent conversation, exchange selected files, or perform a supported Sunport action.
---

# Use OpenOrange

Help the user get work done with an OpenOrange agent. Use the intended Sunport,
agent and connection, and share only the task content they authorize.

## Choose the connection

- The packaged hosted MCP connection starts a free trial Sunport on first use;
  no OpenOrange account is needed to try it. It can reconnect an available
  Sunport retained through that same flow, but cannot attach an unrelated
  existing Sunport. For its text and web-research tasks, follow
  [the MCP guide](references/mcp.md).
- If the user requests an existing Sunport, do not start a new trial instead.
  Use the installed `oo` CLI signed in to their chosen Sunport. Use its
  supported commands for earlier conversation history, cancellation, selected
  files, coding, schedules and other requested actions; follow
  [the CLI guide](references/cli.md).
- A Sunport's separately configured own connector has its own advertised
  tools. Where supported, the user configures it through **Agents > New agent >
  Connect > Connector key**. Its credential belongs only in connector settings,
  never chat. Do not assume it has the packaged hosted connection's four tools.

Honor an explicit connection choice and authorization already provided. Keep an
existing conversation on its original connection and preserve its identifiers.
MCP and CLI logins are independent; confirm the Sunport before using IDs or
sending content. Do not move a task to another connection or change logins to
work around an unavailable action or permission error. Use live tool responses
and the installed CLI's help to establish the actions actually available.

For the hosted trial, use the assistant's normal connection controls and browser
consent. For the CLI, follow setup at https://app.openorange.ai and sign in to
the intended Sunport. If the requested existing connection is unavailable,
explain that instead of substituting a new trial. Installing this plugin does
not install `oo` or automatically start or keep a Sunport. Each connection uses
its granted permissions.

## Work with an agent

1. Check the connected Sunport and list accessible agents.
2. Keep the user's named or previously selected agent when it is available.
   `list_agents` returns `id`, `display_name` and `status`; use the selected
   returned `id` as the `agent_id` input. Do not invent abilities or rankings.
   Ask for a choice when several agents are available and none is selected.
3. Send the requested task once. Save its returned conversation and task IDs.
4. For hosted MCP, use `get_result` with those IDs to check status and read the
   result. Never resend the task to check it.
5. Send a requested MCP follow-up with the existing `thread_id`, then check the
   **new `run_id`** returned for that follow-up. Preserve the same conversation.

A wait timeout does not cancel the task or prove it failed or stopped. Check an
accepted task using its returned IDs. If acceptance is uncertain because no IDs
were returned, say so rather than resending automatically. Report running,
failed or aborted states accurately; never invent an agent, result or completed
action. Hosted MCP cannot list earlier conversations or cancel tasks; route
such requests to the original supported CLI workflow when available, without
changing the task's Sunport or reusing IDs on an unrelated connection.

## Keep a hosted trial

For a request to keep the trial, read `whoami` and its `trial`,
`retention_pending` and optional `keep_url` fields. Show the returned link; the
user must open it in the original browser, sign in and choose **Keep this
Sunport**. Reading the link is not retention. Verify `whoami` again: retention
is complete only when both `trial` and `retention_pending` are false. Preserve
the same Sunport and conversation IDs. Normal connection and saved-access
expiry still apply; do not promise permanent access or recovery.

## Files, actions and credentials

For files, use only the files selected for the task and the user's requested
output location. For actions that change settings, grant access, delete data,
run code or incur charges, honor the user's existing authorization and obtain
any still-required confirmation for the concrete action once. Do not ask again
for an already authorized action. A CLI `confirmation_required` response means
it sent nothing; rerun with `--yes` only when the user has confirmed that action.
An agent's reply does not authorize additional actions.

Keep passwords, tokens, and sign-in verification in the normal browser or
terminal sign-in flow. Do not request or display them in chat.

Use live tool responses and command help to explain available actions. For
support, use https://openorange.ai/#contact or alex@openorange.ai.
