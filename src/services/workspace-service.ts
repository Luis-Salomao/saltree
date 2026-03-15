import { access } from "node:fs/promises"
import { join, resolve } from "node:path"

/**
 * WorkspaceService — Detects and validates workspace context.
 *
 * Suporta dois padrões:
 *   - Repo normal: dir com `.git/` (ou arquivo `.git` em worktrees)
 *   - Saltree workspace: dir com `.repo/` (git fica em .repo/, worktrees no root)
 */
export class WorkspaceService {
  /**
   * Dado um workspaceRoot, retorna o caminho do repo git efetivo.
   * Se existir `.repo/` dentro, retorna `workspaceRoot/.repo`.
   * Caso contrário, retorna `workspaceRoot` (padrão normal).
   */
  static async resolveRepoPath(workspaceRoot: string): Promise<string> {
    const repoPath = join(workspaceRoot, ".repo")
    try {
      await access(repoPath)
      return repoPath
    } catch {
      return workspaceRoot
    }
  }

  /**
   * Walks up the filesystem from cwd until finding:
   *   - A directory with `.git` (normal repo or worktree)
   *   - A directory with `.repo/` (saltree workspace container)
   * Returns the workspace root or null if not found.
   */
  static async detectWorkspace(cwd: string): Promise<string | null> {
    let current = resolve(cwd)
    const root = resolve("/") // On Windows, this becomes C:\ or similar

    while (current !== root) {
      // Standard: .git dir or file (normal repo / worktree)
      try {
        await access(join(current, ".git"))
        return current
      } catch { }

      // Saltree: .repo/ subdir (workspace container pattern)
      try {
        await access(join(current, ".repo"))
        return current
      } catch { }

      const parent = resolve(current, "..")
      if (parent === current) break
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
