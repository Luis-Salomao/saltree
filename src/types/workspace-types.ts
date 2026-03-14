export type WorkspaceCreateMode = "new-local" | "clone-https"

export interface WorkspaceCreateOptions {
  projectName: string
  mode: WorkspaceCreateMode
  repoUrl?: string
  baseDir?: string
  defaultBranch?: string
}

export interface BareRepoOptions {
  barePath: string
  repoUrl?: string
  defaultBranch?: string
}

export interface BareRepoConfig {
  fetchParallel: number
  writeCommitGraph: boolean
  worktreeRelativePaths: boolean
  gcWorktreePruneExpire: string
  enableMaintenance: boolean
}

export interface WorkspaceInfo {
  id: string
  projectName: string
  barePath: string
  basePath: string
  owner: string
  repoType: WorkspaceCreateMode
  repoUrl?: string
  defaultBranch: string
  worktreeCount: number
  exists: boolean
  active: boolean
  createdAt: string
}
