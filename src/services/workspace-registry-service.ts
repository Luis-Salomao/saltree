import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import {
  DEFAULT_WORKSPACE_REGISTRY,
  WorkspaceRegistrySchema,
  type WorkspaceItem,
  type WorkspaceRegistry,
} from "../schemas/workspace-registry-schema.js"
import type { WorkspaceInfo } from "../types/index"
import { executeGitCommand } from "../utils/git-commands.js"

export class WorkspaceRegistryService {
  private registry: WorkspaceRegistry
  private registryPath: string

  constructor(registryPath?: string) {
    this.registry = { ...DEFAULT_WORKSPACE_REGISTRY }
    this.registryPath = registryPath || this.resolveDefaultPath()
  }

  private resolveDefaultPath(): string {
    return join(homedir(), ".saltree", "workspaces.json")
  }

  async load(): Promise<WorkspaceRegistry> {
    try {
      await access(this.registryPath)
      const content = await readFile(this.registryPath, "utf-8")
      const parsed = JSON.parse(content)
      const result = WorkspaceRegistrySchema.safeParse(parsed)
      if (result.success) {
        this.registry = result.data
      }
    } catch {
      // Arquivo não existe ainda
    }
    return this.registry
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.registryPath), { recursive: true })
    await writeFile(this.registryPath, JSON.stringify(this.registry, null, 2), "utf-8")
  }

  generateId(): string {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, "")
    const seq = String(this.registry.items.length + 1).padStart(3, "0")
    return `ws_${date}_${seq}`
  }

  async addWorkspace(item: Omit<WorkspaceItem, "id" | "createdAt">): Promise<WorkspaceItem> {
    const workspace: WorkspaceItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    }
    this.registry.items.push(workspace)
    await this.save()
    return workspace
  }

  async removeWorkspace(id: string): Promise<boolean> {
    const index = this.registry.items.findIndex((w) => w.id === id)
    if (index === -1) return false
    this.registry.items.splice(index, 1)
    await this.save()
    return true
  }

  async deactivateWorkspace(id: string): Promise<boolean> {
    const workspace = this.registry.items.find((w) => w.id === id)
    if (!workspace) return false
    workspace.active = false
    await this.save()
    return true
  }

  getWorkspaces(activeOnly = true): WorkspaceItem[] {
    if (activeOnly) {
      return this.registry.items.filter((w) => w.active)
    }
    return [...this.registry.items]
  }

  getWorkspaceById(id: string): WorkspaceItem | undefined {
    return this.registry.items.find((w) => w.id === id)
  }

  getWorkspaceByPath(basePath: string): WorkspaceItem | undefined {
    return this.registry.items.find((w) => w.basePath === basePath)
  }

  async getWorkspacesWithInfo(): Promise<WorkspaceInfo[]> {
    const items = this.getWorkspaces()
    const infos: WorkspaceInfo[] = []

    for (const item of items) {
      let worktreeCount = 0
      try {
        const result = await executeGitCommand(["worktree", "list", "--porcelain"], item.barePath)
        if (result.success) {
          worktreeCount = result.stdout.split("\n").filter((l) => l.startsWith("worktree ")).length
        }
      } catch {
        // Bare repo pode não existir mais
      }

      const info: WorkspaceInfo = {
        id: item.id,
        projectName: item.projectName,
        barePath: item.barePath,
        basePath: item.basePath,
        owner: item.owner,
        repoType: item.repoType,
        defaultBranch: item.defaultBranch,
        worktreeCount,
        active: item.active,
        createdAt: item.createdAt,
      }
      if (item.repoUrl) {
        info.repoUrl = item.repoUrl
      }
      infos.push(info)
    }

    return infos
  }
}
