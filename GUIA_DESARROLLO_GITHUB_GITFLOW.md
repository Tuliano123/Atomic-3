# Guía de desarrollo (Git + GitHub) — Atomic BP/RP (JavaScript)

**Contexto**
- IDE: Visual Studio Code
- Lenguaje principal: JavaScript (Bedrock Script API)
- Repositorio remoto: GitHub
- Automatización: GitHub Actions
- Asistente: GitHub Copilot
- Control de versiones local: Git

**Objetivo**
Adoptar un flujo de trabajo más profesional sin complicar el proyecto: mantener `main` estable, integrar trabajo en `develop`, y desarrollar en ramas `feature/*` con Pull Requests y checks automáticos.

---

> **📖 NOTA:** Si es tu primera vez con GitFlow o necesitas instrucciones paso a paso MUY detalladas (con capturas, verificaciones en VSCode/GitHub, troubleshooting), consulta:
> 
> **[GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md](GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md)**
> 
> Este archivo es un resumen ejecutivo; la guía detallada tiene instrucciones completas para cada paso.

---

## 1) Principios (lo mínimo que cambia el juego)

1. **`main` siempre estable**
   - En `main` no se trabaja directo.
   - Todo entra por Pull Request (PR) y con checks aprobados.

2. **Integración en `develop`**
   - `develop` es donde se juntan features antes de liberar.
   - `develop` también debe tener checks (idealmente igual de estrictos que `main`).

3. **Trabajo aislado en ramas cortas**
   - Cada cambio va en una rama: `feature/*` o `hotfix/*`.
   - Ramas pequeñas = PRs fáciles de revisar = menos bugs.

4. **Automatización como “quality gate”**
   - Los errores “tontos” (conflictos, formato, JSON inválido) se bloquean automáticamente.

---

## 2) Modelo de ramas: GitFlow ligero

### Nombres de ramas
- `main`: estable / liberable
- `develop`: integración
- `feature/<area>-<descripcion>`: nuevas funcionalidades
  - Ejemplos: `feature/skills-lecture-cache`, `feature/ui-chest`, `feature/commands-permissions`
- `hotfix/<descripcion>`: arreglos urgentes desde `main`
  - Ejemplo: `hotfix/fix-scoreboard-id`

### Reglas
- PRs siempre:
  - `feature/*` → `develop`
  - `develop` → `main` (release)
  - `hotfix/*` → `main` (y luego volver a `develop`)

---

## 3) Migración desde “commits directos en main” (sin reescribir historia)

> Esta migración evita `rebase`/reescritura de historia: se conserva todo lo ya commiteado en `main`.

---

### PASO 1: Crear rama `develop` desde `main`

#### 1.1 Asegúrate de tener todo el trabajo guardado
Antes de empezar, **NO debe haber cambios sin commit** en tu workspace.

**En VSCode:**
- Abre el panel Source Control (Ctrl+Shift+G).
- Si ves archivos en "Changes", haz commit o descártalos antes de continuar.

**En PowerShell:**
```powershell
git status
```
- Debe decir: `nothing to commit, working tree clean`
- Si hay cambios, commitea primero o `git stash` temporalmente.

---

#### 1.2 Ir a la rama `main` y actualizarla
```powershell
git checkout main
git pull origin main
```

**Qué esperar:**
- `git checkout main` → "Switched to branch 'main'" (o "Already on 'main'")
- `git pull origin main` → "Already up to date" (o descarga commits si hay nuevos)

**En VSCode:**
- Abajo a la izquierda verás el nombre de la rama: debe decir `main`.

---

#### 1.3 Crear la rama `develop` localmente
```powershell
git checkout -b develop
```

**Qué esperar:**
- Verás: `Switched to a new branch 'develop'`
- En VSCode, abajo a la izquierda ahora dice: `develop`

**¿Por qué no se ve aún en GitHub?**
- La rama `develop` ahora SOLO existe en tu máquina local.
- GitHub no la conoce hasta que la empujes (next step).

---

#### 1.4 Subir `develop` a GitHub (primera vez)
```powershell
git push -u origin develop
```

**Qué esperar:**
- Verás algo como:
  ```
  Total 0 (delta 0), reused 0 (delta 0)
  To https://github.com/<tu-usuario>/<tu-repo>.git
   * [new branch]      develop -> develop
  Branch 'develop' set up to track remote branch 'develop' from 'origin'.
  ```

**Verificar en GitHub:**
1. Ve a tu repo en GitHub.
2. Click en el dropdown de ramas (arriba a la izquierda, donde dice `main`).
3. Ahora deberías ver: `main` y `develop`.

**¿Por qué pusimos `-u origin develop`?**
- `-u` (o `--set-upstream`) "vincula" tu rama local `develop` con `origin/develop` (GitHub).
- A partir de ahora, un simple `git push` o `git pull` desde `develop` sabrá dónde ir automáticamente.

---

#### 1.5 (Opcional) Establecer `develop` como rama por defecto en GitHub
Si quieres que los PRs nuevos apunten por defecto a `develop`:
1. En GitHub: Settings → Branches.
2. En "Default branch", cambiar de `main` a `develop`.
3. Confirmar.

> **Nota:** esto no es estrictamente necesario si eres explícito al abrir PRs, pero ayuda a prevenir errores.

---

### PASO 2: Configurar protecciones de rama en GitHub

**Objetivo:** impedir que tú o tu compañero hagan `git push` directo a `main` o `develop` sin pasar por PR.

#### 2.1 Proteger `main`
1. Ve a tu repo en GitHub.
2. Click en **Settings** (tab superior derecho).
3. En el menú izquierdo: **Branches**.
4. Click en **Add branch protection rule** (o si ya hay reglas, edita `main`).
5. En "Branch name pattern": escribe `main`.
6. Activa:
   - ☑ **Require a pull request before merging**
     - Sub-opción: **Require approvals** → mínimo 1 (si trabajas con alguien más).
   - ☑ **Require status checks to pass before merging** (cuando tengas Actions, activa esto).
   - ☑ **Do not allow bypassing the above settings** (incluye a admins).
   - ☑ **Block force pushes** (evita reescribir historia).
7. Click **Create** o **Save changes**.

#### 2.2 Proteger `develop` (mismo procedimiento)
Repetir el paso anterior, pero con "Branch name pattern": `develop`.

**Resultado:**
- Ahora, si intentas `git push origin main` sin PR, GitHub lo rechazará.
- Deberás abrir un Pull Request para mergear cambios.

---

### PASO 3: Cambiar la disciplina desde hoy

**Regla nueva:**
- ❌ NO más `git checkout main` + `git commit` + `git push`.
- ✅ SÍ: rama `feature/*` → commit → push → PR → merge a `develop`.

**¿Qué hago si ya commiteé en `main` por error?**
1. Si **NO has hecho push aún**:
   ```powershell
   git checkout develop
   git cherry-pick <commit-id>
   git checkout main
   git reset --hard origin/main
   ```
2. Si **YA hiciste push**, déjalo (por esta vez) y sigue la nueva disciplina de ahora en adelante.

---

## 4) Flujo diario (paso a paso)

### Crear una feature
1. Partir desde `develop` actualizado:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/<area>-<descripcion>
   ```

2. Trabajar y commitear en pequeños lotes.
3. Subir rama:
   ```bash
   git push -u origin feature/<area>-<descripcion>
   ```
4. Abrir PR en GitHub: `feature/*` → `develop`.

### Revisar y mergear
- Checklist del PR:
  - Compila/carga en el mundo (prueba manual mínima)
  - Checks de Actions en verde
  - Revisión del compañero (al menos 1 aprobación)
  - No “mezclar temas”: si el PR toca 2 features, dividir.

### Release (pasar a main)
1. Crear PR: `develop` → `main`.
2. Al mergear, **taggear versión** (ver sección 6).

### Hotfix
1. Crear hotfix desde `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/<descripcion>
   ```
2. PR `hotfix/*` → `main`.
3. Después del merge, PR adicional para traerlo a `develop` (o merge `main` → `develop`).

---

## 5) Convenciones de commits (simple y útil)

Recomendación: **Conventional Commits** (ayuda a leer historial y automatizar releases).

Formato:
- `feat: ...` nueva funcionalidad
- `fix: ...` bug fix
- `refactor: ...` refactor sin cambiar comportamiento
- `chore: ...` mantenimiento (tooling, deps)
- `docs: ...` documentación

Ejemplos:
- `feat: add lecture stat registry`
- `fix: prevent double init in lecture`
- `chore: add github actions ci`

Reglas:
- Un commit = un tema.
- Mensajes descriptivos (no “update”, no “fix stuff”).

---

## 6) Versionado y releases

### Versión semántica (SemVer)
Usar `MAJOR.MINOR.PATCH`:
- **PATCH**: bugfix sin cambios grandes
- **MINOR**: nuevas features compatibles
- **MAJOR**: cambios incompatibles

### Tag
- Tag en Git: `v1.0.1`
- Ideal: alinear con `manifest.json` del pack.

Proceso recomendado:
1. PR `develop` → `main`.
2. Merge.
3. Crear tag y (opcional) GitHub Release.

---

## 7) Checks automáticos (GitHub Actions)

Objetivo: bloquear merges rotos con validaciones baratas.

Checks recomendados:
1. **Lint** (ESLint): errores comunes, imports, etc.
2. **Format check** (Prettier): evitar diffs por estilo.
3. **Typecheck en JS** (JSDoc + `@ts-check` o TypeScript `checkJs`): detectar errores de tipos sin migrar a TS.
4. **Validación de JSON**: manifest/items/entities/etc. (muy frecuente en packs).

> Nota: aunque el runtime sea Minecraft, estas validaciones se pueden correr en Node.js en CI.

---

## 8) Estructura del repo (sugerencia práctica)

Mantener:
- `Atomic BP/` (Behavior Pack)
- `RP/` (Resource Pack)
- `tools/` (scripts auxiliares)

Agregar en la raíz:
- `README.md` (cómo correr/probar)
- `CONTRIBUTING.md` (cómo colaborar + flujo de ramas)
- `.editorconfig` (formato básico)
- `package.json` (solo tooling)
- `.github/workflows/ci.yml` (Actions)

---

## 9) Estándares de código (JavaScript)

Recomendación de mínimos:
- Evitar “magic strings”: centralizar IDs (como ya hacéis con registries).
- Mantener `initX(config)` por feature y evitar side-effects al importar.
- Guardar configuración en `config.js` por módulo.
- Mantener funciones pequeñas, especialmente en loops de tick.

Sobre Bedrock:
- Priorizar lógica “tick-safe”: try/catch en bordes, evitar trabajo pesado por tick.
- Cachear resultados si el input no cambia (como firma de equipamiento).

---

## 10) Uso de Copilot (práctica profesional)

Copilot es excelente para:
- Boilerplate (registries, parsers, validadores)
- Refactors mecánicos
- Escribir tests unitarios de utilidades

Buenas prácticas:
- Pedirle a Copilot que escriba **primero** el test o el caso de uso.
- Revisar su output como si fuera PR de otra persona.
- No aceptar código que no entiendes (o pedir que lo explique y simplifique).

---

## 11) Checklist de adopción (orden recomendado)

1. Crear rama `develop` desde `main`.
2. Activar branch protection en `main` y `develop`.
3. Introducir PR obligatorio + 1 aprobación.
4. Añadir tooling mínimo (ESLint/Prettier/typecheck/JSON validate).
5. Añadir GitHub Actions para correr lo anterior.
6. Acordar convención de commits.
7. Acordar versión + tags en releases.

---

## 12) Glosario

- **End-to-end (E2E)**: “de punta a punta”; implementar el flujo completo (proceso + tooling + CI), no solo describirlo.
- **GitFlow ligero**: variante simplificada con `main`, `develop`, `feature/*`, `hotfix/*`.
- **Branch protection**: reglas en GitHub que bloquean pushes directos y exigen PR/checks.
- **PR (Pull Request)**: propuesta para integrar cambios; habilita revisión y CI.
- **CI (Continuous Integration)**: automatización que valida el repo en cada PR/push.
- **Quality gate**: condición obligatoria para merge (ej. Actions en verde).
- **Lint (ESLint)**: análisis estático para detectar errores/patrones peligrosos.
- **Formatter (Prettier)**: normaliza estilo para evitar diffs por formato.
- **Typecheck**: verificación de tipos (en JS puede ser con JSDoc/TS `checkJs`).
- **SemVer**: versionado `MAJOR.MINOR.PATCH`.
- **Tag**: marca de versión en Git (ej. `v1.0.1`).
- **Hotfix**: arreglo urgente que sale desde `main`.
