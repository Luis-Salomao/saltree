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
   * Estrutura: workspaceRoot/.repo/ (git), workspaceRoot/sal/ (worktree inicial)
   */
  async initNormalRepo(options: WorkspaceCreateOptions): Promise<WorkspaceInfo> {
    const { projectName, baseDir = process.cwd(), defaultBranch = "main" } = options

    const workspaceRoot = resolve(baseDir, projectName)
    const repoPath = join(workspaceRoot, ".repo")

    // 1. Create directories
    await mkdir(repoPath, { recursive: true })

    // 2. Git init inside .repo/
    try {
      await executeGitCommand(["init", "-b", defaultBranch, repoPath], repoPath)
    } catch (error) {
      // `-b` flag requires git 2.28+; fall back to standard init + rename
      try {
        await executeGitCommand(["init", repoPath], repoPath)
        await executeGitCommand(
          ["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`],
          repoPath
        )
      } catch (fallbackError) {
        throw new Error(`Failed to initialize git repo at ${repoPath}: ${fallbackError}`)
      }
    }

    // 3. Create default saltree.config.json in workspace root (not inside .repo)
    await this.createDefaultConfig(workspaceRoot)

    // 4. Empty initial commit (required to allow worktree creation)
    try {
      await executeGitCommand(
        ["commit", "--allow-empty", "-m", "chore: initialize workspace"],
        repoPath
      )
    } catch (error) {
      throw new Error(`Failed to create initial commit: ${error}`)
    }

    // 5. Create initial worktree (sal/) in workspace root
    const worktreePath = join(workspaceRoot, "sal")
    try {
      await this.createInitialWorktree(repoPath, defaultBranch, worktreePath)
    } catch (error) {
      throw new Error(`Failed to create initial worktree: ${error}`)
    }

    // 6. Copy files from copyPatterns (if configured)
    if (this.config.worktreeCopyPatterns.length > 0) {
      try {
        await copyFiles(worktreePath, worktreePath, this.config)
      } catch (error) {
        console.warn(`Warning: Failed to copy files: ${error}`)
      }
    }

    // 7. Execute post-create commands
    if (this.config.postCreateCmd.length > 0) {
      const variables: TemplateVariables = {
        BASE_PATH: workspaceRoot,
        WORKTREE_PATH: worktreePath,
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
   * Estrutura: workspaceRoot/.repo/ (git), workspaceRoot/sal/ (worktree inicial)
   */
  async cloneNormalRepo(options: WorkspaceCreateOptions): Promise<WorkspaceInfo> {
    const { projectName, repoUrl, baseDir = process.cwd(), defaultBranch = "main" } = options

    if (!repoUrl) {
      throw new Error("repoUrl é obrigatório para clone-https")
    }

    const workspaceRoot = resolve(baseDir, projectName)
    const repoPath = join(workspaceRoot, ".repo")

    // 1. Create workspace container dir
    await mkdir(workspaceRoot, { recursive: true })

    // 2. Git clone into .repo/
    try {
      await executeGitCommand(["clone", repoUrl, repoPath], workspaceRoot)
    } catch (error) {
      throw new Error(`Failed to clone repo from ${repoUrl}: ${error}`)
    }

    // 3. Create default saltree.config.json in workspace root (not inside .repo)
    try {
      await this.createDefaultConfig(workspaceRoot)
    } catch (error) {
      console.warn(`Warning: Failed to create config: ${error}`)
    }

    // 4. Checkout default branch (if different from clone default)
    try {
      const branches = await executeGitCommand(["branch", "-a"], repoPath)
      if (branches.stdout.includes(defaultBranch)) {
        await executeGitCommand(["checkout", defaultBranch], repoPath)
      }
    } catch (error) {
      console.warn(`Warning: Failed to checkout ${defaultBranch}: ${error}`)
    }

    // 5. Create initial worktree (sal/) in workspace root
    const worktreePath = join(workspaceRoot, "sal")
    try {
      await this.createInitialWorktree(repoPath, defaultBranch, worktreePath)
    } catch (error) {
      console.warn(`Warning: Failed to create initial worktree: ${error}`)
    }

    // 6. Copy files from copyPatterns (if configured)
    if (this.config.worktreeCopyPatterns.length > 0) {
      try {
        await copyFiles(worktreePath, worktreePath, this.config)
      } catch (error) {
        console.warn(`Warning: Failed to copy files: ${error}`)
      }
    }

    // 7. Execute post-create commands
    if (this.config.postCreateCmd.length > 0) {
      const variables: TemplateVariables = {
        BASE_PATH: workspaceRoot,
        WORKTREE_PATH: worktreePath,
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
   * Cria a worktree inicial em worktreePath a partir do repoPath (.repo/).
   * Detacha o HEAD no .repo/ para liberar a branch para a worktree.
   */
  private async createInitialWorktree(
    repoPath: string,
    branch: string,
    worktreePath: string
  ): Promise<string> {
    try {
      // Detach HEAD so 'main' branch is no longer checked out in .repo/
      await executeGitCommand(["checkout", "--detach"], repoPath)

      // git worktree add <absolute-path> <branch>
      await executeGitCommand(["worktree", "add", worktreePath, branch], repoPath)
    } catch (error) {
      throw new Error(
        `Failed to create worktree at ${worktreePath} on branch ${branch}: ${error}`
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
