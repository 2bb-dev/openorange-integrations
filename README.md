# OpenOrange

Bring the agent team you've already configured in OpenOrange into your chat.
Delegate research, drafting and planning. Tasks run on OpenOrange in the
background; return to check results and keep refining the work in the same
agent conversation.

Connect your Sunport (your OpenOrange server) to use your existing agents.
For selected files, coding sessions and permitted server actions, add the
optional `oo` CLI.

[OpenOrange](https://openorange.ai) · [Get connected](https://app.openorange.ai) ·
[Privacy](https://openorange.ai/privacy/) · [Terms](https://openorange.ai/terms/) ·
[Support](https://openorange.ai/#contact)

## Choose how to connect

| Connection | What you can do | What you need |
| --- | --- | --- |
| MCP | Delegate text tasks with web search, check results, and continue agent conversations | Connect OpenOrange in your assistant and approve access in the browser |
| Optional `oo` CLI | Work with selected files, coding sessions, conversations, and permitted server actions | The separately installed official `oo` CLI, terminal access, and a Sunport login |

The MCP connection provides four tools:

| Tool | What it does |
| --- | --- |
| `whoami` | Check your connected Sunport and access |
| `list_agents` | Find the agents available to you |
| `ask_agent` | Send a text task or follow-up in the same agent conversation |
| `get_result` | Read an accepted task's status and result |

MCP tasks support text and web search only. They cannot use files, run commands
or change your Sunport.

Both connections use your existing permissions. Installing the plugin does not
install the CLI or grant Sunport access. Check the selected Sunport before
sending a task; MCP and CLI connections can point to different Sunports.
OpenOrange service billing is separate.

## Try a task

> List my OpenOrange agents and help me choose one for a research task.

> Ask my OpenOrange agent to research three ways a small team can cut meeting time, with sources.

> Ask my OpenOrange agent to plan a Friday launch: docs are unfinished and rollback needs an owner.

For a file task, connect the CLI and choose the file you want to share:

> Use my OpenOrange Sunport to summarize this selected report and save the result here.

The assistant checks the connection, uses the agent you select, and reports the
actual result or current task status. Return to that conversation to check an
accepted task or ask the agent to revise its work.

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

The OpenAI package is in [`packages/openai/openorange-connect`](packages/openai/openorange-connect).
Use its packaged release where your OpenAI client supports plugin installation.
Availability in the public directory depends on OpenAI approval.

Both packages use the same [MCP guide](usage/references/mcp.md) and
[CLI guide](usage/references/cli.md), with the connection format required by each
assistant. Additional assistants can reuse these usage guides.

Share only the messages and files needed for your task. OpenOrange and your
assistant service handle the content you send and the results you retrieve.
See the linked privacy policy for data handling. Questions: alex@openorange.ai.

Copyright © 2026 OpenOrange. Proprietary; see [LICENSE](LICENSE).
