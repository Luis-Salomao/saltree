import { Text, useInput } from "ink"
import { access } from "node:fs/promises"
import { join } from "node:path"
import { useCallback, useEffect, useState } from "react"
import packageJson from "../../package.json" with { type: "json" }
import { COLORS } from "../constants/index.js"
import { AppStateService } from "../services/app-state-service.js"
import { ConfigService } from "../services/config-service.js"
import { GlobalSettingsService } from "../services/global-settings-service.js"
import { WorktreeService } from "../services/index.js"
import type { ShellIntegrationStatus } from "../services/shell-integration-service.js"
import { detectShellIntegration } from "../services/shell-integration-service.js"
import type { UpdateCheckResult } from "../services/update-service.js"
import {
  checkForUpdates,
  getCachedUpdateStatus,
  shouldCheckForUpdates,
} from "../services/update-service.js"
import type { AppMode } from "../types/index.js"
import { getGitRoot, getUserFriendlyErrorMessage } from "../utils/index.js"
import { Onboarding } from "../panels/onboarding/index.js"
import { AppRouter } from "./app-router.js"
import { ErrorState } from "./error-state.js"
import { LoadingState } from "./loading-state.js"

const VERSION = packageJson.version

interface AppProps {
  initialMode?: AppMode
  isFromWrapper?: boolean
  onExit?: () => void
}

export function App({ initialMode = "menu", isFromWrapper = false, onExit }: AppProps) {
  const [mode, setMode] = useState<AppMode>(initialMode)
  const [worktreeService, setWorktreeService] = useState<WorktreeService | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)
  const [lastMenuIndex, setLastMenuIndex] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [gitRoot, setGitRoot] = useState<string>()
  const [shellIntegrationStatus, setShellIntegrationStatus] =
    useState<ShellIntegrationStatus | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckResult | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [canUseWorktreeCommands, setCanUseWorktreeCommands] = useState(false)
  const [globalSettingsService] = useState(() => new GlobalSettingsService())

  const initialize = useCallback(async (): Promise<void> => {
    try {
      // Carregar settings globais e verificar onboarding
      await globalSettingsService.load()
      if (globalSettingsService.needsOnboarding()) {
        setNeedsOnboarding(true)
        setInitializing(false)
        setLoading(false)
        return
      }

      const root = await getGitRoot()
      const workingDir = root || process.cwd()
      setGitRoot(workingDir)

      // Worktree commands are available only inside a Saltree workspace.
      // A valid workspace has local config at the repo root.
      try {
        await access(join(workingDir, "saltree.config.json"))
        setCanUseWorktreeCommands(true)
      } catch {
        setCanUseWorktreeCommands(false)
      }

      setInitializing(false)

      setLoading(true)
      setError(undefined)

      detectShellIntegration()
        .then(setShellIntegrationStatus)
        .catch(() => {
          setShellIntegrationStatus({
            isInstalled: false,
            shell: "unknown",
            configPath: null,
            reason: "Detection failed",
          })
        })

      // WorktreeService só funciona dentro de um git repo — falha silenciosa fora
      try {
        const service = new WorktreeService(workingDir)
        await service.initialize()
        setWorktreeService(service)
      } catch {
        // Fora de git repo: worktree commands indisponíveis, app continua normalmente
        setCanUseWorktreeCommands(false)
      }

      const appStateService = new AppStateService()
      await appStateService.load()

      if (shouldCheckForUpdates(appStateService)) {
        checkForUpdates(VERSION, appStateService)
          .then(setUpdateStatus)
          .catch(() => {
            const cached = getCachedUpdateStatus(appStateService, VERSION)
            if (cached) {
              setUpdateStatus(cached)
            }
          })
      } else {
        const cached = getCachedUpdateStatus(appStateService, VERSION)
        if (cached) {
          setUpdateStatus(cached)
        }
      }

    } catch (err) {
      setError(getUserFriendlyErrorMessage(err instanceof Error ? err : new Error(String(err))))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExit = useCallback((): void => {
    onExit?.()
  }, [onExit])

  const handleBackToMenu = useCallback((): void => {
    setMode("menu")
  }, [])

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      handleExit()
    }

    if (error && !loading && !showResetConfirm) {
      if (input?.toLowerCase() === "r") {
        setShowResetConfirm(true)
        return
      }

      setError(undefined)
      if (mode !== "menu") {
        setMode("menu")
      }
    }
  })

  const handleResetConfig = async (): Promise<void> => {
    try {
      setShowResetConfirm(false)
      setLoading(true)

      const tempConfigService = new ConfigService()
      await tempConfigService.createGlobalConfig()

      await initialize()
    } catch (err) {
      setError(`Failed to reset configuration: ${err}`)
      setLoading(false)
    }
  }

  const handleMenuSelect = (value: AppMode | "exit", selectedIndex?: number): void => {
    if (selectedIndex !== undefined) {
      setLastMenuIndex(selectedIndex)
    }

    if (!canUseWorktreeCommands && (value === "create" || value === "list" || value === "delete")) {
      setError(
        "Comandos de worktree so funcionam dentro de um workspace SalTree. Entre em um workspace criado pelo SalTree e tente novamente."
      )
      return
    }

    if (value === "exit") {
      handleExit()
    } else {
      setMode(value)
    }
  }

  const handleOnboardingComplete = useCallback(async (userName: string): Promise<void> => {
    globalSettingsService.setUserName(userName)
    await globalSettingsService.save()
    setNeedsOnboarding(false)
    setInitializing(true)
    setLoading(true)
    await initialize()
  }, [globalSettingsService, initialize])

  useEffect(() => {
    initialize()
  }, [initialize])

  if (initializing) {
    return null
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (loading) {
    return <LoadingState mode={mode} gitRoot={gitRoot} />
  }

  if (error) {
    return (
      <ErrorState
        mode={mode}
        error={error}
        showResetConfirm={showResetConfirm}
        onResetConfirm={handleResetConfig}
        onResetCancel={() => setShowResetConfirm(false)}
      />
    )
  }

  return (
    <AppRouter
      mode={mode}
      worktreeService={worktreeService}
      lastMenuIndex={lastMenuIndex}
      gitRoot={gitRoot}
      shellIntegrationStatus={shellIntegrationStatus}
      canUseWorktreeCommands={canUseWorktreeCommands}
      updateStatus={updateStatus}
      isFromWrapper={isFromWrapper}
      onMenuSelect={handleMenuSelect}
      onBackToMenu={handleBackToMenu}
      onExit={handleExit}
      onShellIntegrationComplete={() => {
        detectShellIntegration()
          .then(setShellIntegrationStatus)
          .catch(() => {})
      }}
    />
  )
}
