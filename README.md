# OpenOrange

Research and write with agents.

Send research, writing and planning tasks to an OpenOrange agent from chat.
Compare options with sources, turn pasted notes into an action plan, review a
draft or rewrite it for a different audience. Find the agents available to your
connection and send a task. Let it run, then check back for its status and result
or ask for changes in the same conversation. The conversation flow supports text and web research. Compatible hosted
deployments also offer Google Workspace tools after separate explicit approval.

[OpenOrange](https://openorange.ai) · [Get connected](https://app.openorange.ai) ·
[Privacy](https://openorange.ai/privacy/) · [Terms](https://openorange.ai/terms/) ·
[Support](https://openorange.ai/#contact)

## Get started

For conversation access, connect OpenOrange through your assistant's controls
to start a trial Sunport (an OpenOrange server). No OpenOrange account is needed to try it.
The browser connection flow handles consent and trial availability.

To keep that Sunport and its conversations, open the optional Keep link returned
by `whoami` in the original browser, sign in and choose **Keep this Sunport**.
The link alone does not retain the trial. Connections and saved access can
expire; keeping the Sunport does not make that access permanent.

The conversation flow can reconnect an available saved Sunport retained through
it. It does not attach unrelated Sunports; Google access uses the separate
ready-Sunport selection and approval flow below.

## What the hosted connection can do

| Tool | What it does |
| --- | --- |
| `whoami` | Check the connected Sunport and access expiry; get the optional Keep link |
| `list_agents` | Find the agents available to this connection |
| `ask_agent` | Send a text task or follow up in the same agent conversation |
| `get_result` | Check an accepted task's status and read its result |
| `ask_approval` | Ask a person to approve one exact action, where the hosted server offers it |
| `ask_secret` | Ask a person for a secret they type in on their Sunport, never in chat |
| `check_approval` | Read an approval or secret request's status, as the Sunport records it |
| `cancel_approval` | Withdraw an approval or secret request you asked for that still waits |

Read an accepted task with `get_result` rather than sending it again. A follow-up
uses the same conversation and creates a new task to check. These conversation tools support text and web research. Local files, Code and
Sunport administration use the CLI; Google operations use the separate tools below.

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
Contacts and Tasks on compatible releases. Follow [the MCP guide](usage/references/mcp.md)
for the exact tool names, identity checks, confirmation, expiry and revocation.
An older server may advertise only four conversation tools; updating this
package does not deploy or enable the service. Discovery and granted scopes
remain authoritative.

## Already have a Sunport?

Use the optional official `oo` CLI on a compatible computer and sign in to your
chosen Sunport. It can exchange selected files, start and continue coding
sessions, read earlier conversations, review usage and perform supported agent
and server actions. Availability depends on its installed version and your
permissions. Follow the [CLI guide](usage/references/cli.md).

Where your Sunport offers its own connector, open **Agents > New agent > Connect**
and use its **Connector key** in your assistant's connector settings. Keep that
credential in the connector settings, never in chat. This separately configured
connector has its own advertised toolset; it is distinct from this package's
hosted connection and its separately approved Google tools.

## Connection choices

| Connection | What you can do | What you need |
| --- | --- | --- |
| Hosted MCP | Conversations plus advertised Google Workspace tools | Conversation/trial flow, or separate ready-Sunport and named-agent approval followed by Google consent |
| Optional `oo` CLI | Selected files, coding, earlier conversations, usage and supported actions | Separate CLI installation and sign-in to your chosen Sunport |
| Your Sunport's own connector | The tools that connector advertises | Separate connector setup and its credential, where supported |

Each connection uses its granted permissions. Installing the plugin does not
install the CLI or automatically start or keep a Sunport. Confirm the connected
Sunport before sending content; separate connections can target different ones.
OpenOrange service billing is separate.

## Try a task

> Ask an OpenOrange agent to compare three tools for customer feedback, with sources.

> Ask an OpenOrange agent to turn these notes into a plan: launch Friday; docs unfinished; rollback owner missing.

> Ask an OpenOrange agent to improve this draft: Our app helps small teams plan work and track what gets done.

For a file task, connect the CLI and choose the file you want to share:

> Use the oo CLI on my chosen Sunport to summarize this selected report and save the result here.

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

Both packages show the orange ring without a background (`assets/openorange.svg`).
Where a directory asks for an uploaded icon instead, such as the Claude
directory's listing, use [`assets/openorange-icon-1024.png`](assets/openorange-icon-1024.png),
the same transparent ring.

Share only the messages and files needed for your task. OpenOrange and your
assistant service handle the content you send and the results you retrieve.
See the linked privacy policy for data handling. Questions: alex@openorange.ai.

Copyright © 2026 OpenOrange. Proprietary; see [LICENSE](LICENSE).
