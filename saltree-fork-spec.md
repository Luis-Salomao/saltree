# Saltree fork spec (branchlet -> saltree)

## 1. Objetivo
Criar um fork do branchlet chamado `saltree`, focado no seu fluxo com Git bare e com experiencia guiada no primeiro uso.

O produto deve:
- pedir o nome do usuario na primeira execucao;
- salvar esse nome em configuracao global;
- listar workspaces criados pelo proprio saltree (registro interno);
- criar workspace em dois modos: novo repo Git e clone via HTTPS;
- manter operacoes normais apos criacao (listar/deletar/fluxo atual);
- permitir configuracao local por repo via `saltree.config.json`;
- tratar branch names com `/` no path do Windows sem quebrar o nome real da branch no Git.

## 2. Decisoes confirmadas
- Documento: na raiz do projeto.
- Nome do usuario salvo globalmente em `~/.saltree/settings.json`.
- Lista de workspaces: registro proprio do saltree (nao so `git worktree list`).
- Modos de criacao no MVP:
  - novo repositorio Git local;
  - clone de repositorio via HTTPS.
- Nome de config local por projeto: `saltree.config.json`.
- Branch naming:
  - manter branch real no Git (ex.: `feat/auth`);
  - sanitizar apenas o nome de pasta/path no filesystem.

## 3. Fluxo de primeira execucao
1. Usuario roda `saltree`.
2. Se `~/.saltree/settings.json` nao tiver `userName`, abrir prompt:
   - "Qual seu nome de usuario/prefixo de workspace?"
3. Persistir em config global.
4. Seguir para menu principal.

### Estrutura global sugerida
Arquivo: `~/.saltree/settings.json`

```json
{
  "userName": "luis",
  "workspaceRegistryFile": "~/.saltree/workspaces.json",
  "defaultBaseDir": "~/workspace"
}
```

## 4. Menu principal (MVP)
- Listar workspaces salvos (registro saltree)
- Criar workspace
- Listar worktrees do repo atual (opcional, secundario)
- Deletar workspace/worktree
- Configuracoes

## 5. Registro de workspaces do saltree
Criar arquivo global: `~/.saltree/workspaces.json`

Exemplo:

```json
{
  "version": 1,
  "items": [
    {
      "id": "ws_20260312_001",
      "owner": "luis",
      "projectName": "api-core",
      "repoType": "clone-https",
      "repoUrl": "https://github.com/org/api-core.git",
      "basePath": "C:/dev/luis/api-core",
      "createdAt": "2026-03-12T12:00:00.000Z",
      "active": true
    }
  ]
}
```

## 6. Criar workspace (novo repo ou clone)
### 6.1 Novo repo Git local
Entrada minima:
- `projectName`
- `baseDir` (opcional; default global)

Fluxo:
1. Criar pasta base do workspace.
2. Inicializar Git (respeitando estrategia bare que voce quer usar).
3. Criar estrutura inicial de projeto conforme template/config.
4. Registrar workspace em `workspaces.json`.

### 6.2 Clone via HTTPS
Entrada minima:
- `repoUrl` HTTPS
- `projectName` (ou derivado da URL)
- `baseDir` (opcional)

Fluxo:
1. Clonar repo para pasta padrao por usuario.
2. Aplicar estrutura/config inicial (se definido).
3. Registrar workspace em `workspaces.json`.

## 7. Estrutura inicial de pasta do projeto
Padrao base por usuario:

`<baseDir>/<userName>/<projectName>/...`

Conteudo inicial configuravel (nao obrigatorio fixo):
- `env/` (quando fizer sentido)
- `config.json`
- pastas por feature sanitizadas no filesystem (ex.: `sal-feat-auth`)
- outros arquivos e comandos definidos no `saltree.config.json`

Observacao:
- `env` pode ou nao existir por projeto.
- Deve ser possivel copiar arquivos sensiveis/infra de forma configuravel (ex.: configs de auth).

## 8. Config local por repo (`saltree.config.json`)
Objetivo: definir o que fazer apos criar repo/worktree e como preparar ambiente.

Exemplo proposto:

```json
{
  "$schema": "./schema.json",
  "projectBootstrap": {
    "createFolders": ["env", "scripts", "docs"],
    "copyPatterns": [".env*", "config/**", "secrets-template/**"],
    "copyIgnores": ["**/node_modules/**", "**/.git/**"],
    "postCreateCmd": [
      "bun install",
      "npm install",
      "python -m venv .venv"
    ]
  },
  "branchPath": {
    "enabled": true,
    "prefix": "sal-",
    "sanitizeForFs": true,
    "replacement": "-"
  }
}
```

Notas:
- Nem todo projeto vai rodar todos os comandos; manter lista configuravel por projeto.
- Comandos podem falhar de forma nao-fatal com log claro.

## 9. Regra para branch name com `/` no Windows
Requisito:
- Branch Git permanece original (ex.: `feat/auth`, `fix/login` etc).
- Nome de pasta/worktree usa versao sanitizada para filesystem.

Funcao sugerida:
- Entrada: `feat/auth/google`
- Saida path: `feat-auth-google`

Regras minimas:
- substituir `/` e `\\` por `-`;
- remover caracteres invalidos no Windows (`<>:"|?*`);
- trim de pontos/espacos finais;
- evitar nomes reservados (`CON`, `PRN`, `AUX`, `NUL`, `COM1`...);
- limitar tamanho de segmento para evitar erro de path longo.

## 10. Compatibilidade e migracao
- Manter suporte ao arquivo ja existente `.saltree.json` durante periodo de transicao.
- Prioridade de leitura sugerida:
  1. `saltree.config.json`
  2. `.saltree.json` (legacy)
  3. global `~/.saltree/settings.json`

## 11. Plano de implementacao sugerido
1. Estender schema/config para `userName`, registry e bootstrap local.
2. Adicionar onboarding de primeira execucao (prompt de usuario).
3. Criar `WorkspaceRegistryService` para CRUD de workspaces.
4. Implementar comando/listagem de workspaces salvos.
5. Implementar fluxo de criar workspace em 2 modos (novo repo, clone HTTPS).
6. Implementar sanitizacao robusta de nomes para filesystem.
7. Integrar bootstrap local (`saltree.config.json`) na criacao de repo/worktree.
8. Cobrir com testes de unidade e integracao.

## 12. Pendencias para validar depois
- Definir exatamente como seu fluxo bare deve ser aplicado no modo "novo repo" (layout e comandos Git finais).
- Definir se o bootstrap deve ter perfis por stack (Node/Python/Bun) ou so lista livre de comandos.
- Definir se a listagem principal mostra apenas registro saltree ou se combina com `git worktree list`.
