# Ghost Typist

A Claude Code mod that makes it feel like you are typing while the agent codes.

When the agent calls `Write`, `Edit`, `MultiEdit`, `NotebookEdit` or `Bash`, Ghost Typist
catches the code in the model's stream *as it is generated* and types it out in a side
pane at a human pace, with a cursor and keyboard sounds.

It only shows things: the agent never waits for the typing.

## Install

```
/plugin install ghost-typist --marketplace gaupoit/ghost-typist
```

The pane opens on its own when the agent starts writing, on a terminal at least
144 columns wide. On a narrower one, type `/typist` to open it.

## Commands

| Command | What it does |
| --- | --- |
| `/typist` | Open the pane |
| `/typist on` / `off` | Turn typing on or off for this session |
| `/typist mode hacker` | Hacker Typer mode: you type it (see below) |
| `/typist mode watch` | Back to typing by itself |
| `/typist speed 140` | Base speed in words per minute |
| `/typist sound clicky` | `clicky`, `thock` or `off` |
| `/typist status` | Show the current settings |

Defaults are in `/config` (mode, speed, sound, which tools to type, auto-open).

## Hacker Typer mode

`/typist mode hacker` opens the pane with the keyboard in it. Every key you press types
the next 3 to 5 characters of the agent's code (indentation comes for free). Stop
pressing and the code waits for you. When the agent starts its next call, the one you
were on finishes by itself, so you never fall behind. Esc returns to the prompt; click
the pane or press ctrl+x tab to come back.

## How it works

- A `turn.step` hook passes every chunk of the model's stream on unchanged, and copies
  the tool call's argument pieces (incomplete JSON) into a queue.
- A small partial-JSON reader pulls out `content`, `new_string`, `new_source` or
  `command` as it arrives, escapes and all.
- In watch mode, a 50 ms ticker types it at the chosen speed with human timing: pauses at newlines and
  brackets, near-free indentation, random variation. It speeds up when it falls more
  than ~600 characters behind, and once the model finishes the call it types the rest
  within 1.5 seconds, so it never lags far behind the agent.
- Sound is one looped clip, started and stopped with the typing (macOS `afplay`; Linux
  terminals stay silent).

Subagent calls are not typed. For `Edit`, only the new text is typed.

## Develop

```
claude --plugin-dir .
claude plugin validate .
claude plugin test .
```

The clips in `sounds/` are synthesised (`scripts/gen_sounds.py`).

## License

MIT
