import { mkdir, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { WorkspaceCreateOptions, TemplateVariables } from "../types/index.js"
import type { WorktreeConfig } from "../schemas/config-schema.js"
import { DEFAULT_CONFIG } from "../constants/index.js"
import { executeGitCommand } from "../utils/git-commands.js"
import { copyFiles, executePostCreateCommands } from "./file-service.js"

export interface WorkspaceInfo {
  id: string
  projectName: string
  workspaceRoot: string
  baseDir: string
  repoType: "new-local" | "clone-https"
  repoUrl?: string
  defaultBranch: string
  createdAt: string
}

export class NormalRepoService {
  private config: WorktreeConfig

  constructor(config?: Partial<WorktreeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Inicializa um workspace novo (git init).
   * Cria repo normal, .saltree/, initial commit, e primeira worktree.
   */
  async initNormalRepo(options: WorkspaceCreateOptions): Promise<WorkspaceInfo> {
    const { projectName, baseDir = process.cwd(), defaultBranch = "main" } = options

    const workspaceRoot = resolve(baseDir, projectName)

    // 1. Create workspace directory
    await mkdir(workspaceRoot, { recursive: true })

    // 2. Git init (normal repo, not bare), set initial branch name
    try {
      await executeGitCommand(["init", "-b", defaultBranch, workspaceRoot], workspaceRoot)
    } catch (error) {
      // `-b` flag requires git 2.28+; fall back to standard init + rename
      try {
        await executeGitCommand(["init", workspaceRoot], workspaceRoot)
        await executeGitCommand(
          ["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`],
          workspaceRoot
        )
      } catch (fallbackError) {
        throw new Error(`Failed to initialize git repo at ${workspaceRoot}: ${fallbackError}`)
      }
    }

    // 3. Create default saltree.config.json (not tracked — in .git/info/exclude)
    await this.createDefaultConfig(workspaceRoot)

    // 4. Empty initial commit (required to allow worktree creation; no files added)
    try {
      await executeGitCommand(
        ["commit", "--allow-empty", "-m", "chore: initialize workspace"],
        workspaceRoot
      )
    } catch (error) {
      throw new Error(`Failed to create initial commit: ${error}`)
    }

    // 6. Copy files from copyPatterns (if configured)
    if (this.config.worktreeCopyPatterns.length > 0) {
      try {
        await copyFiles(workspaceRoot, workspaceRoot, this.config)
      } catch (error) {
        console.warn(`Warning: Failed to copy files: ${error}`)
      }
    }

    // 7. Create initial worktree (sal/ on main branch)
    const initialWorktreeName = "sal"
    try {
      await this.createInitialWorktree(workspaceRoot, defaultBranch, initialWorktreeName)
    } catch (error) {
      throw new Error(`Failed to create initial worktree: ${error}`)
    }

    // 8. Execute post-create commands
    if (this.config.postCreateCmd.length > 0) {
      const variables: TemplateVariables = {
        BASE_PATH: workspaceRoot,
        WORKTREE_PATH: join(workspaceRoot, initialWorktreeName),
        BRANCH_NAME: defaultBranch,
        SOURCE_BRANCH: defaultBranch,
      }

      try {
        await executePostCreateCommands(this.config.postCreateCmd, variables)
      } catch (error) {
        console.warn(`Warning: Post-create commands failed: ${error}`)
      }
    }

    return {
      id: `${projectName}-${Date.now()}`,
      projectName,
      workspaceRoot,
      baseDir,
      repoType: "new-local",
      defaultBranch,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Clona um repo como normal (git clone).
   * Cria .saltree/, initial worktree, e executa pós-create.
   */
  async cloneNormalRepo(options: WorkspaceCreateOptions): Promise<WorkspaceInfo> {
    const { projectName, repoUrl, baseDir = process.cwd(), defaultBranch = "main" } = options

    if (!repoUrl) {
      throw new Error("repoUrl é obrigatório para clone-https")
    }

    const workspaceRoot = resolve(baseDir, projectName)

    // 1. Git clone
    try {
      await executeGitCommand(["clone", repoUrl, workspaceRoot], baseDir)
    } catch (error) {
      throw new Error(`Failed to clone repo from ${repoUrl}: ${error}`)
    }

    // 2. Create default saltree.config.json if doesn't exist
    try {
      await this.createDefaultConfig(workspaceRoot)
    } catch (error) {
      console.warn(`Warning: Failed to create config: ${error}`)
    }

    // 4. Checkout default branch (if different from clone default)
    try {
      const branches = await executeGitCommand(["branch", "-a"], workspaceRoot)
      if (branches.stdout.includes(defaultBranch)) {
        await executeGitCommand(["checkout", defaultBranch], workspaceRoot)
      }
    } catch (error) {
      console.warn(`Warning: Failed to checkout ${defaultBranch}: ${error}`)
    }

    // 5. Copy files from copyPatterns (if configured)
    if (this.config.worktreeCopyPatterns.length > 0) {
      try {
        await copyFiles(workspaceRoot, workspaceRoot, this.config)
      } catch (error) {
        console.warn(`Warning: Failed to copy files: ${error}`)
      }
    }

    // 6. Create initial worktree (sal/ on main branch)
    const initialWorktreeName = "sal"
    try {
      await this.createInitialWorktree(workspaceRoot, defaultBranch, initialWorktreeName)
    } catch (error) {
      // Don't fail clone if worktree creation fails
      console.warn(`Warning: Failed to create initial worktree: ${error}`)
    }

    // 7. Execute post-create commands
    if (this.config.postCreateCmd.length > 0) {
      const variables: TemplateVariables = {
        BASE_PATH: workspaceRoot,
        WORKTREE_PATH: join(workspaceRoot, initialWorktreeName),
        BRANCH_NAME: defaultBranch,
        SOURCE_BRANCH: defaultBranch,
      }

      try {
        await executePostCreateCommands(this.config.postCreateCmd, variables)
      } catch (error) {
        console.warn(`Warning: Post-create commands failed: ${error}`)
      }
    }

    return {
      id: `${projectName}-${Date.now()}`,
      projectName,
      workspaceRoot,
      baseDir,
      repoType: "clone-https",
      repoUrl,
      defaultBranch,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Cria a worktree inicial (sal/) na branch padrão.
   * Para funcionar: detacha o HEAD no workspace root, liberando main para worktree.
   */
  private async createInitialWorktree(
    workspaceRoot: string,
    branch: string,
    worktreeName: string
  ): Promise<string> {
    const worktreePath = join(workspaceRoot, worktreeName)

    try {
      // Detach HEAD so 'main' branch is no longer checked out in workspace root.
      // This allows creating a worktree for 'main' at sal/
      await executeGitCommand(["checkout", "--detach"], workspaceRoot)

      // git worktree add sal main (or default branch)
      await executeGitCommand(["worktree", "add", worktreePath, branch], workspaceRoot)
    } catch (error) {
      throw new Error(
        `Failed to create worktree ${worktreeName} on branch ${branch}: ${error}`
      )
    }

    return worktreePath
  }

  /**
   * Cria saltree.config.json default se não existir.
   */
  private async createDefaultConfig(workspaceRoot: string): Promise<void> {
    const configPath = join(workspaceRoot, "saltree.config.json")

    try {
      // Check if already exists (don't overwrite)
      const fs = await import("node:fs/promises")
      try {
        await fs.access(configPath)
        return // Already exists
      } catch {
        // Doesn't exist, create it
      }

      const defaultConfig = {
        worktreeCopyPatterns: this.config.worktreeCopyPatterns,
        worktreeCopyIgnores: this.config.worktreeCopyIgnores,
        postCreateCmd: this.config.postCreateCmd,
        terminalCommand: this.config.terminalCommand,
        deleteBranchWithWorktree: this.config.deleteBranchWithWorktree,
      }

      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
    } catch (error) {
      throw new Error(`Failed to create default config: ${error}`)
    }
  }
}
