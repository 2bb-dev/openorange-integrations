# OpenOrange

Research and write with agents.

Send research, writing and planning tasks to an OpenOrange agent from chat.
Compare options with sources, turn pasted notes into an action plan, review a
draft or rewrite it for a different audience. Find the agents available to your
connection and send a task. Let it run, then check back for its status and result
or ask for changes in the same conversation. The conversation flow supports text and web research. Compatible hosted
deployments also offer Google Workspace tools after separate explicit approval.

## Get connected

For conversation access, connect OpenOrange in your assistant to start a trial Sunport (an
OpenOrange server). No OpenOrange account is needed to try it; the browser flow
handles consent and trial availability. To keep it and its conversations, open
the optional Keep link returned by `whoami` in the original browser, sign in and
choose **Keep this Sunport**. The link alone does not keep the trial, and keeping
it does not make connection or saved access permanent.

The conversation flow reconnects available saved Sunports retained through it;
Google access uses the separate ready-Sunport selection and approval below.

| Hosted tool | What it does |
| --- | --- |
| `whoami` | Check the connected Sunport and access expiry; get the optional Keep link |
| `list_agents` | Find the agents available to this connection |
| `ask_agent` | Send a text task or follow up in the same agent conversation |
| `get_result` | Check an accepted task's status and read its result |

## Google Workspace

When the deployed server advertises Google tools, sign in to the App, select a
ready Sunport and approve a named connected agent in that Sunport's browser
flow. Approve `connections:read` and, when needed, `connections:write`; then
separately approve the intended Google capabilities and Google consent.
Existing conversation credentials do not gain Google access, and a trial is
not created for this flow.

The eight tools list grants, request and follow consent, discover the operation
catalog, perform an authorized action, disconnect a grant, search Gmail and
read a message. They cover Gmail, Calendar, Drive, Docs, Sheets, Slides,
Contacts and Tasks on compatible releases. Follow [the MCP guide](skills/openorange/references/mcp.md)
for the exact tool names, identity checks, confirmation, expiry and revocation.
An older server may advertise only four conversation tools; updating this
package does not deploy or enable the service. Discovery and granted scopes
remain authoritative.

## Already have a Sunport?

Use the optional official `oo` CLI on a compatible computer and sign in to your
chosen Sunport. It supports selected files, coding sessions, earlier
conversations, usage and other supported agent/server actions, according to its
installed version and your permissions. Follow setup at https://app.openorange.ai
and the [CLI guide](skills/openorange/references/cli.md).

Where your Sunport offers its own connector, open **Agents > New agent > Connect**
and use its **Connector key** in your assistant's connector settings. Credentials
belong in those settings, never in chat. That separately configured connector
has its own advertised tools and identity, distinct from this hosted connection.

Each connection uses its granted permissions. Installing the plugin does not
install the CLI or automatically start or keep a Sunport. Confirm the connected
Sunport before sharing content or conversation identifiers; separate connections
can target different Sunports. OpenOrange service billing is separate.

## Try it

> Ask an OpenOrange agent to compare three tools for customer feedback, with sources.

> Ask an OpenOrange agent to turn these notes into a plan: launch Friday; docs unfinished; rollback owner missing.

> Ask an OpenOrange agent to improve this draft: Our app helps small teams plan work and track what gets done.

The assistant uses the agent you select and reports the actual result or
current task status. Return to that conversation to check an accepted task or
ask the agent to revise its work.

For a selected file with the CLI:

> Use the oo CLI on my chosen Sunport to summarize this selected report and save the result here.

Follow the [MCP guide](skills/openorange/references/mcp.md) for hosted conversations and approved Google work,
or the [CLI guide](skills/openorange/references/cli.md) for files, coding, earlier
conversations, cancellation, schedules and other actions the installed version
supports. Preserve the task's original connection and identifiers.

Share only content needed for the task. OpenOrange and your assistant service
handle the messages, selected files, and results you use.

[OpenOrange](https://openorange.ai) · [Privacy](https://openorange.ai/privacy/) ·
[Terms](https://openorange.ai/terms/) · [Support](https://openorange.ai/#contact)

Questions: alex@openorange.ai. Copyright © 2026 OpenOrange. Proprietary;
see [LICENSE](LICENSE).
