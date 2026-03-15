import { Box } from "ink"
import { useState } from "react"
import { COLORS } from "../constants/index.js"
import { BorderContext } from "../contexts/border-context.js"
import {
  CreateWorkspacePanel,
  CreateWorktree,
  DeleteWorktree,
  ListWorktrees,
  MainPanel,
  SettingsMenu,
  SetupShellIntegration,
  WorkspacesPanel,
} from "../panels/index.js"
import type { WorktreeService } from "../services/index.js"
import type { ShellIntegrationStatus } from "../services/shell-integration-service.js"
import type { UpdateCheckResult } from "../services/update-service.js"
import type { AppMode } from "../types/index.js"
import { IntroSplash } from "./intro-splash.js"
import { UpdateBanner } from "./update-banner.js"
import { WelcomeHeader } from "./welcome-header.js"

interface AppRouterProps {
  mode: AppMode
  worktreeService: WorktreeService | null
  lastMenuIndex: number
  gitRoot?: string | undefined
  shellIntegrationStatus: ShellIntegrationStatus | null
  canUseWorktreeCommands: boolean
  updateStatus: UpdateCheckResult | null
  isFromWrapper: boolean
  onMenuSelect: (value: AppMode | "exit", selectedIndex?: number) => void
  onBackToMenu: () => void
  onExit: () => void
  onShellIntegrationComplete: () => void
}

export function AppRouter({
  mode,
  worktreeService,
  lastMenuIndex,
  gitRoot,
  shellIntegrationStatus,
  canUseWorktreeCommands,
  updateStatus,
  isFromWrapper,
  onMenuSelect,
  onBackToMenu,
  onExit,
  onShellIntegrationComplete,
}: AppRouterProps) {
  const [borderColor, setBorderColor] = useState<string>(COLORS.MUTED)
  const [introComplete, setIntroComplete] = useState(false)

  return (
    <BorderContext.Provider value={{ setBorderColor }}>
      <Box flexDirection="column">
        {!introComplete ? (
          <IntroSplash gitRoot={gitRoot} onComplete={() => setIntroComplete(true)} />
        ) : (
          <>
            <UpdateBanner updateStatus={updateStatus} />
            <WelcomeHeader mode={mode} gitRoot={gitRoot} />

            {mode === "menu" && (
              <Box borderStyle="round" paddingX={1} borderColor={COLORS.MUTED}>
                <MainPanel
                  onSelect={onMenuSelect}
                  onCancel={onExit}
                  defaultIndex={lastMenuIndex}
                  shellIntegrationStatus={shellIntegrationStatus}
                  canUseWorktreeCommands={canUseWorktreeCommands}
                />
              </Box>
            )}

            {mode === "create" && worktreeService && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <CreateWorktree
                  worktreeService={worktreeService}
                  onComplete={onBackToMenu}
                  onCancel={onBackToMenu}
                />
              </Box>
            )}

            {mode === "list" && worktreeService && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <ListWorktrees
                  worktreeService={worktreeService}
                  onBack={onBackToMenu}
                  isFromWrapper={isFromWrapper}
                  onPathSelect={(path) => {
                    process.stdout.write(`${path}\n`)
                    onExit()
                  }}
                />
              </Box>
            )}

            {mode === "delete" && worktreeService && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <DeleteWorktree
                  worktreeService={worktreeService}
                  onComplete={onBackToMenu}
                  onCancel={onBackToMenu}
                />
              </Box>
            )}

            {mode === "settings" && worktreeService && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <SettingsMenu worktreeService={worktreeService} onBack={onBackToMenu} />
              </Box>
            )}

            {mode === "workspaces" && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <WorkspacesPanel onBack={onBackToMenu} />
              </Box>
            )}

            {mode === "create-workspace" && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <CreateWorkspacePanel onBack={onBackToMenu} onComplete={onBackToMenu} />
              </Box>
            )}

            {mode === "setup" && (
              <Box borderStyle="round" paddingX={1} borderColor={borderColor}>
                <SetupShellIntegration
                  shellIntegrationStatus={shellIntegrationStatus}
                  onComplete={() => {
                    onShellIntegrationComplete()
                    onBackToMenu()
                  }}
                  onCancel={onBackToMenu}
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </BorderContext.Provider>
  )
}
