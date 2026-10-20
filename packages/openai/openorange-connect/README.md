# OpenOrange

Bring the agent team you've already configured in OpenOrange into your chat.
Delegate research, drafting and planning. Tasks run on OpenOrange in the
background; return to check results and keep refining the work in the same
agent conversation.

Connect your Sunport (your OpenOrange server) to check access, find available
agents, send a text task or follow-up, and read its status and result.
The MCP connection supports text tasks with web search only; it cannot use
files, run commands or change your Sunport.

For selected files, coding sessions and permitted server actions, use the
optional official `oo` CLI on a compatible computer.

## Get connected

For text tasks, connect OpenOrange in your assistant and approve access in the
browser. CLI actions require separate installation and sign-in: follow the
setup at https://app.openorange.ai, then sign in to your chosen Sunport.

Installing this plugin does not install the CLI or grant Sunport access.
Both connections use your existing permissions. MCP and CLI connections can
select different Sunports. Confirm the Sunport before sharing messages, files,
or conversation identifiers. OpenOrange service billing is separate.

## Try it

> List my OpenOrange agents and help me choose one for a research task.

> Ask my OpenOrange agent to research three ways a small team can cut meeting time, with sources.

> Ask my OpenOrange agent to plan a Friday launch: docs are unfinished and rollback needs an owner.

The assistant uses the agent you select and reports the actual result or
current task status. Return to that conversation to check an accepted task or
ask the agent to revise its work.

For a selected file with the CLI:

> Ask my OpenOrange agent to summarize this report and save the result here.

Follow the [MCP guide](skills/openorange/references/mcp.md) for connected text
tasks, or the [CLI guide](skills/openorange/references/cli.md) for selected files,
coding sessions, and other supported actions. Availability depends on the
connected Sunport, installed version, and your existing permissions.

Share only content needed for the task. OpenOrange and your assistant service
handle the messages, selected files, and results you use.

[OpenOrange](https://openorange.ai) · [Privacy](https://openorange.ai/privacy/) ·
[Terms](https://openorange.ai/terms/) · [Support](https://openorange.ai/#contact)

Questions: alex@openorange.ai. Copyright © 2026 OpenOrange. Proprietary;
see [LICENSE](LICENSE).
