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

1. **Crear `develop` desde el estado actual de `main`**
   ```bash
   git checkout main
   git pull
   git checkout -b develop
   git push -u origin develop
   ```

2. **Cambiar la disciplina desde hoy**
   - Desde este punto, **no más commits directos** en `main`.
   - Nuevo trabajo:
     - ramas `feature/*` desde `develop`
     - PR hacia `develop`

3. **Configurar protecciones de rama en GitHub**
   - En GitHub: Settings → Branches
   - Proteger `main` y `develop`:
     - Require a pull request before merging
     - Require status checks to pass before merging
     - (Opcional) Require approvals (mínimo 1)
     - Block force pushes

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
