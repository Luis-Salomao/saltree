import { SelectPrompt } from "../../components/common/index.js"
import { COLORS, MESSAGES } from "../../constants/index.js"
import type { ShellIntegrationStatus } from "../../services/shell-integration-service.js"
import type { AppMode, SelectOption } from "../../types/index.js"

interface MainPanelProps {
  onSelect: (value: AppMode | "exit", selectedIndex?: number) => void
  onCancel: () => void
  defaultIndex?: number
  shellIntegrationStatus: ShellIntegrationStatus | null
  canUseWorktreeCommands: boolean
}

export function MainPanel({
  onSelect,
  onCancel,
  defaultIndex = 0,
  shellIntegrationStatus,
  canUseWorktreeCommands,
}: MainPanelProps) {
  const getMenuOptions = (): SelectOption<AppMode | "exit">[] => {
    const options: SelectOption<AppMode | "exit">[] = []

    if (shellIntegrationStatus && !shellIntegrationStatus.isInstalled) {
      options.push({
        label: MESSAGES.MENU_SETUP,
        value: "setup",
        color: COLORS.WARNING,
        description: "recommended",
      })
    }

    options.push(
      {
        label: MESSAGES.MENU_WORKSPACES,
        value: "workspaces",
        description: "listar workspaces registrados",
      },
      {
        label: MESSAGES.MENU_CREATE_WORKSPACE,
        value: "create-workspace",
        description: "novo repo ou clone HTTPS",
      }
    )

    if (canUseWorktreeCommands) {
      options.push(
        {
          label: MESSAGES.MENU_CREATE,
          value: "create",
          description: "worktree no workspace atual",
        },
        {
          label: MESSAGES.MENU_LIST,
          value: "list",
        },
        {
          label: MESSAGES.MENU_DELETE,
          value: "delete",
        }
      )
    }

    options.push(
      {
        label: MESSAGES.MENU_SETTINGS,
        value: "settings",
      },
      {
        label: MESSAGES.MENU_EXIT,
        value: "exit",
      }
    )

    return options
  }

  return (
    <SelectPrompt
      label={MESSAGES.MENU_TITLE}
      options={getMenuOptions()}
      onSelect={onSelect}
      onCancel={onCancel}
      defaultIndex={defaultIndex}
    />
  )
}
