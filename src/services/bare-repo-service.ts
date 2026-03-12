import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { BareRepoConfig, BareRepoOptions } from "../types/index"
import { executeGitCommand } from "../utils/git-commands.js"

const DEFAULT_BARE_CONFIG: BareRepoConfig = {
  fetchParallel: 8,
  writeCommitGraph: true,
  worktreeRelativePaths: true,
  gcWorktreePruneExpire: "30.days.ago",
  enableMaintenance: true,
}

export class BareRepoService {
  private config: BareRepoConfig

  constructor(config?: Partial<BareRepoConfig>) {
    this.config = { ...DEFAULT_BARE_CONFIG, ...config }
  }

  /**
   * Inicializa um bare repo novo (sem clone).
   * Cria o primeiro worktree com commit inicial.
   */
  async initBare(options: BareRepoOptions): Promise<void> {
    const { barePath, defaultBranch = "main" } = options

    await mkdir(barePath, { recursive: true })

    // git init --bare
    await this.exec(["init", "--bare", barePath])

    // Configurar branch padrão
    await this.exec(["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`], barePath)

    // Aplicar configs profissionais
    await this.applyProfessionalConfig(barePath)
  }

  /**
   * Clona um repo como bare via HTTPS.
   * Configura fetch refspec (crítico — sem isso git fetch não traz nada).
   */
  async cloneBare(options: BareRepoOptions): Promise<void> {
    const { barePath, repoUrl, defaultBranch } = options

    if (!repoUrl) {
      throw new Error("repoUrl é obrigatório para clone-https")
    }

    // git clone --bare <url> <path>
    await this.exec(["clone", "--bare", repoUrl, barePath])

    // CRÍTICO: configurar fetch refspec (clone --bare vem vazio)
    await this.exec(
      ["config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"],
      barePath
    )

    // Fetch para popular refs remotas
    await this.exec(["fetch", "origin"], barePath)

    // Auto-detectar branch padrão se não especificado
    if (defaultBranch) {
      await this.exec(["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`], barePath)
    } else {
      await this.exec(["remote", "set-head", "origin", "--auto"], barePath)
    }

    // Aplicar configs profissionais
    await this.applyProfessionalConfig(barePath)
  }

  /**
   * Cria um worktree a partir do bare repo.
   * Para novo repo: cria branch + commit inicial.
   * Para clone: checkout da branch.
   */
  async addWorktree(
    barePath: string,
    worktreePath: string,
    branch: string,
    options?: { createBranch?: boolean; sourceBranch?: string }
  ): Promise<void> {
    const args = ["worktree", "add"]

    if (options?.createBranch) {
      args.push("-b", branch)
      args.push(worktreePath, options.sourceBranch || "HEAD")
    } else {
      args.push(worktreePath, branch)
    }

    await this.exec(args, barePath)
  }

  /**
   * Cria o worktree principal (main) para um bare repo novo.
   * Inclui commit inicial vazio.
   */
  async createInitialWorktree(
    barePath: string,
    worktreePath: string,
    defaultBranch = "main"
  ): Promise<void> {
    // Criar worktree — para repo novo, usar --detach e depois criar branch
    await this.exec(["worktree", "add", "--detach", worktreePath], barePath)

    // Dentro do worktree: criar commit inicial e branch
    await this.exec(["checkout", "-b", defaultBranch], worktreePath)
    await this.exec(["commit", "--allow-empty", "-m", "initial commit"], worktreePath)
  }

  /**
   * Remove um worktree.
   */
  async removeWorktree(barePath: string, worktreePath: string, force = false): Promise<void> {
    const args = ["worktree", "remove"]
    if (force) args.push("--force")
    args.push(worktreePath)
    await this.exec(args, barePath)
  }

  /**
   * Lista worktrees de um bare repo.
   */
  async listWorktrees(barePath: string): Promise<string[]> {
    const result = await this.exec(["worktree", "list", "--porcelain"], barePath)
    return result.stdout
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.replace("worktree ", ""))
  }

  /**
   * Aplica configurações profissionais ao bare repo.
   * Baseado em boas práticas para paralelismo com IA.
   */
  private async applyProfessionalConfig(barePath: string): Promise<void> {
    const configs: [string, string][] = [
      // Performance de fetch
      ["fetch.parallel", String(this.config.fetchParallel)],
      ["fetch.writeCommitGraph", String(this.config.writeCommitGraph)],
      // Worktree config isolada
      ["extensions.worktreeConfig", "true"],
      // GC de worktrees órfãs
      ["gc.worktreePruneExpire", this.config.gcWorktreePruneExpire],
    ]

    if (this.config.worktreeRelativePaths) {
      configs.push(["worktree.useRelativePaths", "true"])
    }

    for (const [key, value] of configs) {
      await this.exec(["config", key, value], barePath)
    }

    // Manutenção incremental
    if (this.config.enableMaintenance) {
      try {
        await this.exec(["maintenance", "register"], barePath)
      } catch {
        // git maintenance pode não estar disponível em versões antigas
      }
    }
  }

  /**
   * Roda fetch com todas as otimizações.
   */
  async fetchAll(barePath: string): Promise<void> {
    await this.exec(["fetch", "--all", "--prune"], barePath)
  }

  /**
   * Verifica se um path é um bare repo válido.
   */
  async isBareRepo(path: string): Promise<boolean> {
    try {
      const result = await this.exec(["rev-parse", "--is-bare-repository"], path)
      return result.stdout.trim() === "true"
    } catch {
      return false
    }
  }

  private async exec(args: string[], cwd?: string) {
    const result = await executeGitCommand(args, cwd)
    if (!result.success) {
      throw new Error(`git ${args.join(" ")} falhou: ${result.stderr}`)
    }
    return result
  }
}
