# CLI: your OpenOrange workspace

Use the official installed `oo` client. Start with `oo --version` and
`oo --help`; use each command's `--help` for the options supported by that version.
For installation or updates, follow the setup instructions at
https://app.openorange.ai. The plugin does not install the CLI.

## Connect

`oo login --name work` opens browser sign-in and workspace selection. If the
user has already chosen a workspace, use:

```sh
oo --instance WORKSPACE_URL auth login --name work
oo --instance WORKSPACE_URL auth status
oo --instance WORKSPACE_URL agents list
```

Replace `WORKSPACE_URL` with the selected workspace's actual HTTPS address.
Confirm the identity reported by `auth status`, then use that same explicit
workspace for subsequent commands. For a connection-only request, finish after
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
oo --instance WORKSPACE_URL chat create --agent AGENT_ID --title "Requested task"
oo --instance WORKSPACE_URL chat send THREAD_ID --message "USER_REQUESTED_TASK"
oo --instance WORKSPACE_URL chat get THREAD_ID
```

Use actual returned IDs. Sending acknowledges acceptance; read the conversation
for the reply to this task. An earlier reply is not the result of a new task.
Report pending approvals, running tasks, and failures accurately. Send follow-ups
to the same conversation. When requested, `chat abort THREAD_ID` stops its current
reply; read it again to confirm the outcome.

## Selected task files

Upload only a file chosen for the task, using the same login as the conversation:

```sh
oo --instance WORKSPACE_URL files upload ./selected-report.pdf --for chat
oo --instance WORKSPACE_URL chat send THREAD_ID --message "Summarize this report" --attachment ATTACHMENT_ID
oo --instance WORKSPACE_URL chat get THREAD_ID
oo --instance WORKSPACE_URL chat download THREAD_ID FILE_ID --output ./result.txt
```

Use returned attachment and file IDs. Check the command help and upload response
for size limits and attachment expiry. Save to the requested location and avoid
overwriting an existing file without approval. A path mentioned in a reply does
not establish that a downloadable file exists.

## Coding sessions

When the user requests coding work, inspect available sessions and choose the
intended one. Starting or sending work may execute code and consume usage.

```sh
oo --instance WORKSPACE_URL code environments
oo --instance WORKSPACE_URL code list
oo --instance WORKSPACE_URL code start --message "USER_REQUESTED_TASK" --wait
oo --instance WORKSPACE_URL code send SESSION_ID --message "REQUESTED_FOLLOW_UP" --wait
oo --instance WORKSPACE_URL code get SESSION_ID
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
- `jobs get JOB_ID` and `jobs wait JOB_ID` follow an accepted operation.
- `approvals list` and `approvals get` inspect actions awaiting a decision.
- `api routes` and `api route METHOD PATH` describe available public API actions
  and their required permissions. Use `api request` only for the user's requested
  action, with the input documented by that catalog and command help.

Availability depends on the installed version and your permissions. Preserve
the user's filters and scope. Confirm requested changes and any costs or access
grants before proceeding. Do not invent missing commands or routes. For an
accepted job, retain its ID and check its terminal result instead of submitting
the same operation again after a timeout.

## Optional trial and disconnecting

Where offered by the installed CLI, `oo start` connects an available trial or
reuses a saved connection. Run it only when the user requests that flow. Confirm
the returned workspace with `auth status` before sending a task.

To keep a CLI trial, the user runs `claim --email person@example.com` and
`claim --code-stdin` against that same workspace in their own terminal. They
enter the emailed verification code privately. Afterwards, check `claim` and
confirm `claimed: true`. Keep the same workspace and conversation IDs.

When asked to disconnect, use `oo --instance WORKSPACE_URL auth logout`.
Removing the plugin does not revoke the CLI login or delete workspace data.
