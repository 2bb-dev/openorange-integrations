# CLI: your OpenOrange Sunport

Use the official installed `oo` client. Start with `oo --version` and
`oo --help`; use each command's `--help` for the options supported by that version.
For installation or updates, follow the setup instructions at
https://app.openorange.ai. The plugin does not install the CLI.

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
For a new task:

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
to the same conversation. When requested, `chat abort THREAD_ID` stops its current
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

## Other supported actions

Use command help to discover the actions available with this connection:

- `models list` shows available model choices.
- `requests list` shows accessible request activity.
- `export charges --output ./charges.csv` exports accessible charge records.
- `agents config get AGENT_ID` lists an agent's own configuration changes;
  `set`, `unset` and `reset` change them. A key OpenOrange manages is refused,
  with where to change it instead. A key that runs code, such as an MCP server,
  hook, plugin or environment variable, needs the same permission as VM commands.
- `agents browser signin AGENT_ID --page URL` opens the agent's own browser in
  the user's profile and prints the dashboard link where the user signs in to
  that site, never in chat; `agents browser done AGENT_ID` gives it back. Only
  the user's own dashboard web chats with that agent use the login: a task sent
  with `oo` or the API browses in its conversation's own profile instead. It
  needs an administrator's own login with VM admin on the agent.
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
- `permissions list` shows explicit permissions, the user's by default, with
  each area as View or Manage.
- `api routes` and `api route METHOD PATH` describe available public API actions
  and their required permissions. Use `api request` only for the user's requested
  action, with the input documented by that catalog and command help.

Availability depends on the installed version and your permissions. Preserve
the user's filters and scope. Confirm requested changes and any costs or access
grants before proceeding. A risky change, one the dashboard confirms in a
dialog, is confirmed once: without a terminal, `oo` sends nothing and stops with
`confirmation_required` (exit code 3). Run it again with `--yes` only after the
user confirms that change in chat. Do not invent missing commands or routes. For an
accepted job, retain its ID and check its terminal result instead of submitting
the same operation again after a timeout.

## Optional trial and disconnecting

Where offered by the installed CLI, `oo start` connects an available trial or
reuses a saved connection. Run it only when the user requests that flow. Confirm
the returned Sunport with `auth status` before sending a task.

To keep a CLI trial, the user runs `claim --email person@example.com` and
`claim --code-stdin` against that same Sunport in their own terminal. They
enter the emailed verification code privately. Afterwards, check `claim` and
confirm `claimed: true`. Keep the same Sunport and conversation IDs.

When asked to disconnect, use `oo --instance SUNPORT_URL auth logout`.
Removing the plugin does not revoke the CLI login or delete Sunport data.
