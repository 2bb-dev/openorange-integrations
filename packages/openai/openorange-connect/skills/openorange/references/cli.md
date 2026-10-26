# CLI: your OpenOrange Sunport

Use the official installed `oo` client. Start with `oo --version` and
`oo --help`; use each command's `--help` for the options supported by that version.
For installation or updates, follow https://app.openorange.ai/connect,
OpenOrange's one entry; it also connects a terminal or server agent to the
Sunport as an agent of its own. The plugin does not install the CLI.

## Connect

`oo login --name work` opens browser sign-in and Sunport selection. If the
user has already chosen a Sunport, use:

```sh
oo --instance SUNPORT_URL auth login --name work
oo --instance SUNPORT_URL auth status
oo --instance SUNPORT_URL agents list
```

`--instance` takes the Sunport's address: replace `SUNPORT_URL` with the
selected Sunport's actual HTTPS address. Newer `oo` releases show this flag as
`--sunport` in their help; `--instance` works in every release.
Confirm the identity reported by `auth status`, then use that same explicit
Sunport for subsequent commands. For a connection-only request, finish after
listing agents. The user completes sign-in and access approval in the browser.
Where supported, `--no-browser` provides the normal remote-computer login flow.

Use the normal credential store. Do not collect passwords, tokens, or emailed
sign-in codes in chat or command arguments. A missing credential store or a
permission error needs an explanation, not a different login.

## Tasks and follow-ups

Choose an accessible agent from `agents list`. For an existing conversation,
use `chat list --agent AGENT_ID` and read the selected conversation first.
It lists the 25 latest active, or up to 100 with `--limit`; `--order created`
goes through older ones in pages, giving each answer's `next_cursor` to
`--cursor`, and `--unfinished` marks those with a run that hasn't ended.
For a new task (`chat create --cwd DIR` starts an OpenClaw agent's
conversation in a folder, an absolute path in its workspace or a registered
project):

```sh
oo --instance SUNPORT_URL chat create --agent AGENT_ID --title "Requested task"
oo --instance SUNPORT_URL chat send THREAD_ID --message "USER_REQUESTED_TASK"
oo --instance SUNPORT_URL chat get THREAD_ID
```

Use actual returned IDs. Sending acknowledges acceptance; read the conversation
for the reply to this task. An earlier reply is not the result of a new task.
Report pending approvals, running tasks, and failures accurately. A change that
waits for approval is decided in the Sunport, on its card in the dashboard or
with `approvals`, by someone allowed to approve it: report where it waits, and
don't make the change another way. Send follow-ups
to the same conversation; one sent while the agent is still on the previous
message waits for its own turn. When requested, `chat abort THREAD_ID` stops its current
reply; read it again to confirm the outcome.

## Selected task files

Upload only a file chosen for the task, using the same login as the conversation:

```sh
oo --instance SUNPORT_URL files upload ./selected-report.pdf --for chat
oo --instance SUNPORT_URL chat send THREAD_ID --message "Summarize this report" --attachment ATTACHMENT_ID
oo --instance SUNPORT_URL chat get THREAD_ID
oo --instance SUNPORT_URL chat download THREAD_ID FILE_ID --output ./result.txt
```

Use returned attachment and file IDs. Check the command help and upload response
for size limits and attachment expiry. Save to the requested location and avoid
overwriting an existing file without approval. A path mentioned in a reply does
not establish that a downloadable file exists.

## Coding sessions

When the user requests coding work, inspect available sessions and choose the
intended one. Starting or sending work may execute code and consume usage.

```sh
oo --instance SUNPORT_URL code environments
oo --instance SUNPORT_URL code list
oo --instance SUNPORT_URL code start --message "USER_REQUESTED_TASK" --wait
oo --instance SUNPORT_URL code send SESSION_ID --message "REQUESTED_FOLLOW_UP" --wait
oo --instance SUNPORT_URL code get SESSION_ID
```

Use `code wait SESSION_ID` to follow accepted work, or `code cancel SESSION_ID`
when cancellation is requested. Check the result of the current task; a timeout
does not cancel it. For a selected Code input file, use `files upload PATH --for code`
and the returned attachment according to command help.

## Google Workspace

On a compatible installed release, use `oo connections --help` and the catalog
before requesting Google access or choosing an action:

```sh
oo --instance SUNPORT_URL connections catalog
oo --instance SUNPORT_URL connections catalog --service docs
oo --instance SUNPORT_URL connections catalog --operation docs.documents.get
oo --instance SUNPORT_URL connections list
oo --instance SUNPORT_URL connections google --capability docs.read
oo --instance SUNPORT_URL connections status REQUEST_ID
oo --instance SUNPORT_URL connections do CONNECTION_ID docs.documents.get --param documentId=DOCUMENT_ID
```

Use returned IDs and only the requested capabilities. `connections google`
prints a browser link; the person must approve the intended person/agent binding
and Google consent there. An agent requests for itself; a signed-in person can
select an allowed agent with `--agent AGENT_ID`. CLI and hosted MCP credentials
remain separate, so their visible grants need not be identical.

The catalog covers Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts and
Tasks on compatible releases. Read an operation's exact schema before `do`;
use `--params-file FILE.json` for larger inputs. Writes require both local write
permission and that Google grant's service capability. Use `--yes` for a
required confirmation only after the specific action is authorized. On
`google_operation_outcome_unknown`, inspect the exact affected object before
retrying; on `google_reconnect_required`, reconnect through browser consent
without adding capabilities. `connections disconnect CONNECTION_ID --yes`
ends only that selected grant when the user authorizes it. Legacy Gmail search
and read helpers remain available; inspect their command help.

## Other supported actions

Every `oo` carries OpenOrange's own `openorange` skill for its version:
`oo skill` prints it, `oo skill list` lists its references and `oo skill DOC`
prints one, such as `oo skill agent-workflows`. Read the relevant one, and the
command's help, before an action this guide doesn't describe. An `oo` from
before `oo skill` has `oo guide` in its place. `oo skill install` copies the
skill into the agent tools on this computer; run it only when the user asks.

- The dashboard's Models page shows the models the Sunport serves; `models list`
  is an administrator's list of the models added there.
- `requests list`, `models usage`, `billing balance` and `billing charges` show
  accessible request activity, usage and charges.
- `export charges --output ./charges.csv` exports accessible charge records.
- `agents config get AGENT_ID` lists an agent's own configuration changes;
  `set`, `unset` and `reset` change them. A key OpenOrange manages is refused,
  with where to change it instead. A key that runs code, such as an MCP server,
  hook, plugin or environment variable, needs the same permission as VM commands.
- `agents schedules add AGENT_ID "MESSAGE" --at TIME`, or `--cron EXPRESSION
  --tz ZONE`, schedules a reminder or task: at the time, the agent posts the
  message where it was asked. `agents schedules list` and `cancel` manage the
  user's own. Use it, not the assistant's own reminders, for anything that must
  outlive the conversation. OpenClaw agents and Clem have Schedules; Hermes
  agents don't yet.
- `agents channels groups AGENT_ID CHANNEL on` lets people reach an OpenClaw
  agent in the groups its bot is in, when they mention it; `off` keeps it to
  direct messages.
- `secrets set NAME --agent AGENT_ID` gives an agent an API key or credential
  file. The user enters the value in their own terminal or the dashboard, never
  in chat.
- An agent on its own VM has one browser, with one set of logins for all its
  chats. When a site needs a person, the agent asks with a link, and its owner
  or an administrator signs in there and presses Done, never in chat.
  `agents browser open AGENT_ID --page URL` opens a page in it; acting in it
  needs VM admin on the agent. `agents browser status AGENT_ID` says whether
  it's open and gives its Screen page's link to whoever may watch it.
  `agents browser done AGENT_ID` gives it back after helping, but doesn't tell
  a web chat that asked to go on, as Done in that chat does.
- `sunport updates`, `sunport data-sharing` and `sunport desired-state` show
  when updates install, what the Sunport shares with OpenOrange, and whether
  it matches what OpenOrange expects.
- `sunport sign-in` shows whether members may sign in with their OpenOrange
  account, off unless an administrator turns it on, and the logins linked to
  one. A login is linked by its invitation, its own password or an
  administrator's approval, never by email alone. `--unlink` removes a link and
  ends that login's sessions; the login stays.
- `jobs run FAMILY ACTION key=value` queues an operation of a job family;
  `jobs get JOB_ID` and `jobs wait JOB_ID` follow an accepted one.
- `approvals list` and `approvals get` inspect actions awaiting a decision.
  `clem waiting` lists the changes Clem holds for an administrator's click on
  their card, and `clem approve ID` or `clem decline ID` decides one. An
  approved change runs once, exactly as its card shows.
- To act for a person on what another agent relays, a connected agent asks
  them to approve the exact action:
  `approvals ask "SUMMARY" --scope "EXACT ACTION"` asks its owner, or
  `--person EMAIL_OR_ID`, with `--expires-in MINUTES` up to a day.
  `approvals check ID --scope "EXACT ACTION"` exits 0 only when that person
  approved exactly that action; a message that says "approved" is never proof.
  `approvals mine` lists them and `approvals cancel ID` withdraws one that
  still waits. These need `oo` 1.31.0 or later, which updates itself from its
  Sunport, and a Sunport on OpenOrange v1.3.71 or later; `approvals cancel`
  needs v1.3.72.
- `secrets request NAME --agent AGENT_ID --why TEXT` (`--kind file` for a
  file), or `secrets request CREDENTIAL --provider PROVIDER --why TEXT` for one
  of the Sunport's model provider keys, asks the owner, or `--person`, to type
  a secret into their own signed-in Settings › Approvals. Pass them its link;
  never ask for or accept a secret in chat. `approvals check ID` exits 0 once
  it was given; you never see the value. It needs a Sunport on v1.3.72 or later.
- `permissions list` shows explicit permissions, the user's by default, with
  each area as View or Manage.
- `api routes` and `api route METHOD PATH` describe available public API actions
  and their required permissions. `api route POST /api/v1/jobs --capability
  NAME` gives one job's inputs, and `api request GET /api-routes --query
  path=PREFIX` lists the routes under a prefix.
  Use `api request` only for the user's requested action, with the input
  documented by that catalog and command help.

Availability depends on the installed version and your permissions. Preserve
the user's filters and scope. Confirm requested changes and any costs or access
grants before proceeding. A risky change, one the dashboard confirms in a
dialog, is confirmed once: without a terminal, `oo` sends nothing and stops with
`confirmation_required` (exit code 3). Run it again with `--yes` only after the
user confirms that change in chat. Do not invent missing commands or routes. For an
accepted job, retain its ID and check its terminal result instead of submitting
the same operation again after a timeout.

While an update restarts the Sunport, it answers `updating`. `oo` sends a read,
or a change it can safely repeat such as `chat send`, again for about 30
seconds, and no other change. If it still answers `updating`, tell the user the
Sunport is updating and try again in a minute.

## Feedback to OpenOrange

To tell the OpenOrange team about a problem, an idea or a question, in the
person's words:

```bash
oo feedback send --kind bug "Login times out after I approve in the browser."
```

It answers with the receipt: the report's `id`, its `url` and whether it
arrived (`status`). `pending` means the Sunport has it and the team doesn't
yet. With no working login, or a Sunport that can't be reached, `oo` says so
and sends it through the OpenOrange app instead, with `--email` as the
address the team answers. Such a report is unverified.

`oo feedback show <id>` reads its status and the team's replies, and
`oo feedback reply <id> "<text>"` adds details.

## Optional trial and disconnecting

Where offered by the installed CLI, `oo start` connects an available trial or
reuses a saved connection. Run it only when the user requests that flow. Confirm
the returned Sunport with `auth status` before sending a task.
Until the trial is kept, its agent works with web search only: put the
material in the task itself rather than in an uploaded file.

To keep a CLI trial, the user runs `claim --email person@example.com` and
`claim --code-stdin` against that same Sunport in their own terminal. They
enter the emailed verification code privately. Afterwards, check `claim` and
confirm `claimed: true`. Keep the same Sunport and conversation IDs.

When asked to disconnect, use `oo --instance SUNPORT_URL auth logout`.
Removing the plugin does not revoke the CLI login or delete Sunport data.
