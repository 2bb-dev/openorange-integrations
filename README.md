# OpenOrange

Bring your OpenOrange agents into your workflow. Send a task, review the result,
and continue the conversation. Use the `oo` CLI to work with selected task files
and the other actions available in your workspace.

[OpenOrange](https://openorange.ai) · [Get connected](https://app.openorange.ai) ·
[Privacy](https://openorange.ai/privacy/) · [Terms](https://openorange.ai/terms/) ·
[Support](https://openorange.ai/#contact)

## Choose how to connect

| Connection | What you can do | What you need |
| --- | --- | --- |
| MCP | Find agents, send text tasks, read results, and continue a conversation | Connect OpenOrange in your assistant and approve access in the browser |
| `oo` CLI | Work with agents, conversations, selected files, coding sessions, and other supported workspace actions | The official `oo` CLI, terminal access, and a workspace login |

Both connections use your existing permissions. Installing the plugin does not
install the CLI or grant workspace access. Check the selected workspace before
sending a task; MCP and CLI connections can point to different workspaces.

## Try a task

> Show my OpenOrange agents and help me choose one for this task.

> Ask my agent to turn these notes into a five-item checklist.

> Continue that conversation and revise the checklist with these changes.

For a file task, connect the CLI and choose the file you want to share:

> Use my OpenOrange workspace to summarize this selected report and save the result here.

The assistant checks the connection, uses the agent you select, and reports the
actual result or current task status. Follow-ups stay in the same conversation.

## Claude

In Claude Code, add this marketplace and install OpenOrange:

```text
/plugin marketplace add 2bb-dev/openorange-integrations
/plugin install openorange@openorange
```

Approve the OpenOrange connection when prompted. CLI actions additionally need
the installed `oo` client. Availability in the public Claude directory depends
on Anthropic approval.

## OpenAI

The OpenAI package is in [`packages/openai/openorange-usage`](packages/openai/openorange-usage).
Use its packaged release where your OpenAI client supports plugin installation.
Availability in the public directory depends on OpenAI approval.

Both packages use the same [MCP guide](usage/references/mcp.md) and
[CLI guide](usage/references/cli.md), with the connection format required by each
assistant. Additional assistants can reuse these usage guides.

Share only the messages and files needed for your task. OpenOrange and your
assistant service handle the content you send and the results you retrieve.
See the linked privacy policy for data handling. Questions: alex@openorange.ai.

Copyright © 2026 OpenOrange. Proprietary; see [LICENSE](LICENSE).
