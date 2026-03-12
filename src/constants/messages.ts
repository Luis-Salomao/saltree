export const MESSAGES = {
  // Welcome and general
  WELCOME: "SalTree - Git Worktree Manager",

  // Menu options
  MENU_TITLE: "What would you like to do?",
  MENU_SETUP: "Setup Shell Integration",
  MENU_CREATE: "Create new worktree",
  MENU_LIST: "List worktrees",
  MENU_DELETE: "Delete worktree",
  MENU_SETTINGS: "Settings",
  MENU_WORKSPACES: "Workspaces",
  MENU_CREATE_WORKSPACE: "Create workspace",
  MENU_EXIT: "Exit",

  // Create flow
  CREATE_DIRECTORY_PROMPT: "Enter directory name for the new worktree:",
  CREATE_DIRECTORY_PLACEHOLDER: "feature-name",
  CREATE_SOURCE_BRANCH_PROMPT: "Select source branch:",
  CREATE_NEW_BRANCH_PROMPT: "Enter name for new branch (leave blank to use source branch):",
  CREATE_NEW_BRANCH_PLACEHOLDER: "feat/new-feature or leave blank",
  CREATE_CONFIRM_TITLE: "Create Worktree Confirmation",
  CREATE_SUCCESS: "Worktree created successfully!",
  CREATE_CREATING: "Creating worktree...",

  // Delete flow
  DELETE_SELECT_PROMPT: "Select worktree to delete:",
  DELETE_CONFIRM_TITLE: "Delete Worktree Confirmation",
  DELETE_WARNING: "This action cannot be undone.",
  DELETE_SUCCESS: "Worktree deleted successfully!",
  DELETE_DELETING: "Deleting worktree...",

  // List view
  LIST_TITLE: "Git Worktrees",
  LIST_NO_WORKTREES: "No additional worktrees found.",
  LIST_MAIN_INDICATOR: "(main)",
  LIST_DIRTY_INDICATOR: "(dirty)",

  // Validation errors
  ERROR_NOT_GIT_REPO: "Current directory is not a git repository.",
  ERROR_DIRECTORY_EXISTS: "Directory already exists.",
  ERROR_INVALID_DIRECTORY_NAME: "Invalid directory name.",
  ERROR_INVALID_BRANCH_NAME: "Invalid branch name.",
  ERROR_BRANCH_EXISTS: "Branch already exists.",
  ERROR_WORKTREE_EXISTS: "Worktree already exists.",
  ERROR_WORKTREE_HAS_CHANGES: "Worktree has uncommitted changes.",
  ERROR_OPERATION_FAILED: "Operation failed. Please try again.",

  // Git errors
  GIT_ERROR_FETCH: "Failed to fetch git information.",
  GIT_ERROR_CREATE: "Failed to create worktree.",
  GIT_ERROR_DELETE: "Failed to delete worktree.",
  GIT_ERROR_LIST: "Failed to list worktrees.",

  // File operations
  FILES_COPYING: "Copying files...",
  FILES_COPY_SUCCESS: "Files copied successfully.",
  FILES_COPY_ERROR: "Failed to copy some files.",

  // Post-create actions
  POST_CREATE_RUNNING: "Running post-create command...",
  POST_CREATE_SUCCESS: "Post-create command completed.",
  POST_CREATE_ERROR: "Post-create command failed.",

  // Navigation hints
  HINT_ARROW_KEYS: "Use ↑↓ arrow keys to navigate",
  HINT_ENTER_SELECT: "Press Enter to select",
  HINT_ESC_CANCEL: "Press Esc to cancel",
  HINT_CTRL_C_EXIT: "Press Ctrl+C to exit",

  // Loading states
  LOADING_GIT_INFO: "Loading git information...",
  LOADING_BRANCHES: "Loading branches...",
  LOADING_WORKTREES: "Loading worktrees...",

  // Update checking
  UPDATE_AVAILABLE: "Update available",
  UPDATE_CHECK_MENU: "Check for Updates",
  UPDATE_CHECKING: "Checking for updates...",
  UPDATE_UP_TO_DATE: "You're running the latest version",
  UPDATE_FAILED: "Failed to check for updates",
  UPDATE_INSTALL_CMD: "npm install -g saltree",

  // Workspace flow
  WORKSPACE_LIST_TITLE: "Seus workspaces",
  WORKSPACE_NO_WORKSPACES: "Nenhum workspace registrado.",
  WORKSPACE_CREATE_TITLE: "Criar workspace",
  WORKSPACE_CREATE_MODE_PROMPT: "Como deseja criar o workspace?",
  WORKSPACE_CREATE_MODE_NEW: "Novo repositório Git local",
  WORKSPACE_CREATE_MODE_CLONE: "Clonar via HTTPS",
  WORKSPACE_PROJECT_NAME_PROMPT: "Nome do projeto:",
  WORKSPACE_REPO_URL_PROMPT: "URL do repositório (HTTPS):",
  WORKSPACE_BASE_DIR_PROMPT: "Diretório base (Enter para usar padrão):",
  WORKSPACE_CREATING: "Criando workspace...",
  WORKSPACE_CLONE_BARE: "Clonando bare repo...",
  WORKSPACE_INIT_BARE: "Inicializando bare repo...",
  WORKSPACE_CONFIG_REPO: "Configurando repo...",
  WORKSPACE_CREATE_WORKTREE: "Criando worktree principal...",
  WORKSPACE_SUCCESS: "Workspace criado com sucesso!",
} as const

export const COLORS = {
  PRIMARY: "#f2f2f2",
  SUCCESS: "#2f9e44",
  WARNING: "#f08c00",
  ERROR: "#c92a2a",
  INFO: "#0b7285",
  MUTED: "#868e96",
  HIGHLIGHT: "#495057",
} as const
