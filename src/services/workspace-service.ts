import { access } from "node:fs/promises"
import { join, resolve } from "node:path"

/**
 * WorkspaceService — Detects and validates workspace context.
 *
 * A workspace is any directory containing a `.git/` folder.
 * Used to restrict operations (like create-worktree) to workspace context only.
 */
export class WorkspaceService {
  /**
   * Walks up the filesystem from cwd until finding a directory with .git/
   * Returns the workspace root or null if not found.
   */
  static async detectWorkspace(cwd: string): Promise<string | null> {
    let current = resolve(cwd)
    const root = resolve("/") // On Windows, this becomes C:\ or similar

    while (current !== root) {
      const gitDir = join(current, ".git")

      try {
        await access(gitDir)
        return current // Found .git directory
      } catch {
        // Not here, try parent
      }

      const parent = resolve(current, "..")
      if (parent === current) {
        // Reached filesystem root without finding .git
        break
      }

      current = parent
    }

    return null
  }

  /**
   * Checks if cwd is inside a workspace.
   */
  static async isInsideWorkspace(cwd: string): Promise<boolean> {
    return (await this.detectWorkspace(cwd)) !== null
  }

  /**
   * Gets workspace root or throws error if not inside workspace.
   */
  static async getWorkspaceRootOrThrow(
    cwd: string,
    errorMessage?: string
  ): Promise<string> {
    const workspace = await this.detectWorkspace(cwd)

    if (!workspace) {
      throw new Error(
        errorMessage ||
          "create-worktree is only available inside a Saltree workspace. Try creating a workspace first with 'saltree create'."
      )
    }

    return workspace
  }

  /**
   * Alias for getWorkspaceRootOrThrow() — shorter name.
   */
  static async requireWorkspace(cwd: string): Promise<string> {
    return this.getWorkspaceRootOrThrow(cwd)
  }
}
