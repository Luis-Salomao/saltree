#!/usr/bin/env node
import { render } from "ink"
import minimist from "minimist"
import packageJson from "../package.json" with { type: "json" }
import type { CliArgs } from "./cli/index.js"
import { runCli } from "./cli/index.js"
import { App } from "./components/app.js"
import { MESSAGES } from "./constants/index.js"
import type { AppMode } from "./types/index.js"

const VERSION = packageJson.version

function parseArguments(): {
  mode: AppMode
  help: boolean
  isFromWrapper: boolean
  cliArgs: CliArgs | null
} {
  const argv = minimist(process.argv.slice(2), {
    string: ["mode", "name", "source", "branch", "path"],
    boolean: ["help", "version", "from-wrapper", "json", "force"],
    alias: {
      h: "help",
      v: "version",
      m: "mode",
      n: "name",
      s: "source",
      b: "branch",
      p: "path",
      f: "force",
    },
  })

  if (argv.help) {
    return { mode: "menu", help: true, isFromWrapper: false, cliArgs: null }
  }

  if (argv.version) {
    console.log(`Saltree v${VERSION}`)
    process.exit(0)
  }

  const validModes: AppMode[] = ["menu", "create", "list", "delete", "settings"]
  let mode: AppMode = "menu"

  if (argv.mode && validModes.includes(argv.mode as AppMode)) {
    mode = argv.mode as AppMode
  }

  if (argv._.length > 0) {
    const command = argv._[0]
    if (validModes.includes(command as AppMode)) {
      mode = command as AppMode
    }
  }

  // Detect non-interactive CLI mode
  const cliCommands = ["create", "list", "delete"] as const
  const isCliCommand = cliCommands.includes(mode as (typeof cliCommands)[number])
  const hasCliFlags =
    argv.name || argv.source || argv.branch || argv.path || argv.force || argv.json

  const isFromWrapper = argv["from-wrapper"] === true

  if (isCliCommand && hasCliFlags) {
    return {
      mode,
      help: false,
      isFromWrapper: false,
      cliArgs: {
        command: mode as CliArgs["command"],
        name: argv.name || undefined,
        source: argv.source || undefined,
        branch: argv.branch || undefined,
        path: argv.path || undefined,
        json: argv.json || false,
        force: argv.force || false,
      },
    }
  }

  return { mode, help: false, isFromWrapper, cliArgs: null }
}

function showHelp(): void {
  console.log(`
${MESSAGES.WELCOME}

Usage:
  saltree [command] [options]

Commands:
  create     Create a new worktree
  list       List all worktrees
  delete     Delete a worktree
  settings   Manage configuration
  (no command) Start interactive menu

Interactive Options:
  -h, --help     Show this help message
  -v, --version  Show version number
  -m, --mode     Set initial mode
  --from-wrapper Called from shell wrapper (outputs path to stdout)

Non-Interactive Options:
  -n, --name <name>      Worktree directory name (create, delete)
  -s, --source <branch>  Source branch (create)
  -b, --branch <branch>  New branch name; defaults to source (create)
  -p, --path <path>      Worktree path (delete)
  -f, --force            Force delete even with uncommitted changes (delete)
  --json                 Output as JSON (list)

Interactive Examples:
  saltree                # Start interactive menu
  saltree create         # Go directly to create worktree flow
  saltree list           # List all worktrees interactively
  saltree --from-wrapper # Used by shell wrapper to enable directory switching
  saltree delete         # Go directly to delete worktree flow
  saltree settings       # Open settings menu

Non-Interactive Examples:
  saltree create -n my-feature -s main              # Create worktree from main
  saltree create -n my-feature -s main -b feat/foo  # Create with new branch
  saltree list --json                               # List worktrees as JSON
  saltree delete -n my-feature                      # Delete worktree by name
  saltree delete -p /path/to/worktree -f            # Force delete by path

Shell Integration:
  Run 'saltree' and select "Setup Shell Integration" to enable quick directory switching.
  After setup, just run 'saltree' to quickly change to any worktree directory.

Configuration:
  The tool looks for configuration files in the following order:
  1. .saltree.json in current directory
  2. ~/.saltree/settings.json (global config)
`)
}

async function main(): Promise<void> {
  const { mode, help, isFromWrapper, cliArgs } = parseArguments()

  if (help) {
    showHelp()
    process.exit(0)
  }

  // Non-interactive CLI mode
  if (cliArgs) {
    try {
      await runCli(cliArgs)
      process.exit(0)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`Error: ${message}\n`)
      process.exit(1)
    }
  }

  // Interactive TUI mode
  let hasExited = false

  let inkStdin: NodeJS.ReadStream = process.stdin
  let inkStdout: NodeJS.WriteStream = process.stdout

  if (isFromWrapper) {
    process.env.FORCE_COLOR = "3"

    try {
      const fs = require("node:fs")
      const tty = require("node:tty")
      const ttyFd = fs.openSync("/dev/tty", "r+")
      inkStdin = new tty.ReadStream(ttyFd) as unknown as NodeJS.ReadStream
      inkStdout = new tty.WriteStream(ttyFd) as unknown as NodeJS.WriteStream

      Object.defineProperty(inkStdout, "isTTY", { value: true })
      Object.defineProperty(inkStdout, "hasColors", { value: () => true })
      Object.defineProperty(inkStdout, "getColorDepth", { value: () => 24 })
    } catch (error) {
      console.error("Could not open /dev/tty:", error)
    }
  }

  const { unmount } = render(
    <App
      initialMode={mode}
      isFromWrapper={isFromWrapper}
      onExit={() => {
        if (!hasExited) {
          hasExited = true
          unmount()
          process.exit(0)
        }
      }}
    />,
    {
      stdin: inkStdin,
      stdout: inkStdout,
      stderr: process.stderr,
    }
  )

  process.on("SIGINT", () => {
    if (!hasExited) {
      hasExited = true
      unmount()
      process.exit(0)
    }
  })

  process.on("SIGTERM", () => {
    if (!hasExited) {
      hasExited = true
      unmount()
      process.exit(0)
    }
  })
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
