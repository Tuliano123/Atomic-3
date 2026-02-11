# Guía de desarrollo DETALLADA (Git + GitHub) — Atomic BP/RP

**Contexto**
- IDE: Visual Studio Code
- Lenguaje principal: JavaScript (Bedrock Script API)
- Repositorio remoto: GitHub
- Automatización: GitHub Actions
- Asistente: GitHub Copilot
- Control de versiones local: Git

**Objetivo**
Adoptar un flujo de trabajo profesional sin complicar el proyecto: mantener `main` estable, integrar trabajo en `develop`, y desarrollar en ramas `feature/*` con Pull Requests y checks automáticos.

**Nivel de detalle:** Esta guía asume que es tu **primera vez** trabajando con GitFlow y explicará cada paso con verificaciones en VSCode y GitHub.

---

## 1) Principios básicos (qué cambia)

### Antes (lo que hacías)
- Trabajabas directo en `main`.
- `git commit` + `git push` directo.
- Sin PRs ni revisión formal.

### Ahora (lo que harás)
- `main` = estable/publicable, **no se toca directo**.
- `develop` = integración, donde juntas features.
- Trabajo en ramas `feature/*` + PR hacia `develop`.
- Merge a `main` solo cuando `develop` está probado.

---

## 2) Modelo de ramas: GitFlow ligero

### Nombres estándar
- `main`: producción/estable
- `develop`: integración
- `feature/<area>-<descripcion>`: nuevas funcionalidades
- `hotfix/<descripcion>`: arreglos urgentes desde `main`

### Flujo de PRs
- `feature/*` → `develop`
- `develop` → `main` (releases)
- `hotfix/*` → `main` (y luego a `develop`)

---

## 3) Migración paso a paso (desde "commits directos en main")

> **No vas a perder historia ni reescribir nada.** Simplemente crearás una rama `develop` y cambiarás la forma de trabajar desde hoy.

---

### PASO 1: Crear rama `develop` desde `main`

#### 1.1 Asegúrate de tener todo guardado

Antes de empezar, **NO debe haber cambios sin commit**.

**En VSCode:**
1. Presiona `Ctrl+Shift+G` para abrir Source Control.
2. Si ves archivos en la sección "Changes", tienes cambios sin commit:
   - Opción A: haz commit ahora.
   - Opción B: descártalos si no los quieres (botón `⊖` en cada archivo).

**En PowerShell:**
```powershell
git status
```

**Qué debe decir:**
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

Si ves archivos listados, commitea o descártalos primero.

---

#### 1.2 Ir a la rama `main` y actualizarla

```powershell
git checkout main
git pull origin main
```

**Qué esperar:**
- Primera línea:
  ```
  Switched to branch 'main'
  ```
  (O si ya estabas: `Already on 'main'`)

- Segunda línea:
  ```
  Already up to date
  ```
  (O si hay commits nuevos en GitHub, los descargará)

**En VSCode:**
- Mira abajo a la izquierda (barra de estado).
- Debe decir: `main` (con icono de rama).

---

#### 1.3 Crear la rama `develop` localmente

```powershell
git checkout -b develop
```

**Qué esperar:**
```
Switched to a new branch 'develop'
```

**En VSCode:**
- Abajo a la izquierda ahora dice: `develop`

**¿Por qué no se ve en GitHub todavía?**
- Porque la rama `develop` solo existe en tu computadora (local).
- GitHub no sabe nada de ella hasta que la empujes.

---

#### 1.4 Subir `develop` a GitHub (primera vez)

```powershell
git push -u origin develop
```

**Qué esperar:**
```
Total 0 (delta 0), reused 0 (delta 0), pack-reused 0
To https://github.com/<tu-usuario>/<tu-repo>.git
 * [new branch]      develop -> develop
Branch 'develop' set up to track remote branch 'develop' from 'origin'.
```

**Verificar en GitHub:**
1. Abre tu navegador y ve a tu repositorio en GitHub.
2. Arriba a la izquierda (junto al nombre del repo), hay un dropdown que dice `main` o `develop`.
3. Click en ese dropdown.
4. Ahora deberías ver **dos ramas**: `main` y `develop`.

**¿Qué hace `-u origin develop`?**
- `-u` = `--set-upstream`: vincula tu rama local con la remota.
- A partir de ahora, cuando estés en `develop` y hagas `git push` o `git pull`, Git sabrá automáticamente que debe ir a `origin/develop`.

---

#### 1.5 (Opcional) Establecer `develop` como rama por defecto

Si quieres que los PRs nuevos apunten automáticamente a `develop`:

1. En GitHub: tab **Settings** (arriba a la derecha).
2. Menú izquierdo: **Branches**.
3. Sección "Default branch" (arriba de todo).
4. Click en el ícono de switch/edit junto a `main`.
5. Selecciona `develop` del dropdown.
6. Click **Update**.
7. Confirma en el modal.

**Resultado:**
- Ahora, cuando alguien cree un PR sin especificar, apuntará a `develop` por defecto.

---

### PASO 2: Configurar protecciones de rama

**Objetivo:** Impedir que tú o tu compañero hagan `git push` directo a `main` o `develop` sin pasar por un Pull Request.

---

#### 2.1 Proteger `main`

1. Ve a tu repositorio en GitHub.
2. Click en **Settings** (tab arriba a la derecha).
3. Menú izquierdo: **Branches**.
4. Botón **Add branch protection rule** (o edita regla existente si ya hay).
5. Campo "Branch name pattern": escribe `main`.
6. **Activa las siguientes opciones:**

   - ☑ **Require a pull request before merging**
     
     (Expande la sección clickeando en el título si no ves sub-opciones)
     
     - ☑ **Require approvals**: elige `1` (mínimo 1 aprobación para mergear).
     - ☑ **Dismiss stale pull request approvals when new commits are pushed** (si alguien aprobó, pero luego cambias el código, se pierde la aprobación).

   - ☑ **Require status checks to pass before merging**
     
     (Esto lo activarás más adelante cuando tengas GitHub Actions; por ahora déjalo marcado pero sin checks específicos.)

   - ☑ **Do not allow bypassing the above settings** 
     
     (Esto aplica las reglas incluso a administradores.)

   - ☑ **Block force pushes**
     
     (Previene `git push --force`, que reescribe historia.)

7. Scroll abajo → click **Create** (o **Save changes**).

---

#### 2.2 Proteger `develop`

Repite el mismo procedimiento anterior, pero:
- En "Branch name pattern": escribe `develop`.
- Activa las mismas opciones.

---

#### 2.3 Verificar protecciones

**En GitHub:**
- Ve a Settings → Branches.
- Deberías ver 2 reglas:
  - `main` con candado 🔒
  - `develop` con candado 🔒

**¿Qué pasa si intentas pushear directo?**
```powershell
git checkout main
# (intentas commitear algo)
git push origin main
```
GitHub rechazará el push con mensaje:
```
refusing to allow a protected branch to be updated
```

---

### PASO 3: Cambiar la disciplina desde hoy

**Nueva regla:**
- ❌ **NO**: `git checkout main` → commit → push
- ✅ **SÍ**: rama `feature/*` → commit → push → PR → merge

**¿Qué hago si ya commiteé en `main` por error?**

**Si NO hiciste push aún:**
```powershell
# Mover el commit a develop
git checkout develop
git cherry-pick <commit-id>

# Revertir main al estado remoto
git checkout main
git reset --hard origin/main
```

**Si YA hiciste push:**
- Déjalo (por esta vez).
- Sigue la nueva disciplina de ahora en adelante.

---

## 4) Flujo diario (paso a paso MUY detallado)

---

### Crear una feature

---

#### 4.1 Partir desde `develop` actualizado

Cada vez que vas a empezar algo nuevo, primero actualiza `develop`.

**En PowerShell:**
```powershell
git checkout develop
git pull origin develop
```

**Qué esperar:**
- Primera línea: `Switched to branch 'develop'`
- Segunda línea: `Already up to date` (o trae cambios si tu compañero mergeó algo).

**En VSCode:**
- Abajo a la izquierda debe decir: `develop`

---

#### 4.2 Crear tu rama de feature

**Formato del nombre:**
```
feature/<area>-<descripcion-corta>
```

**Ejemplos BUENOS:**
- `feature/skills-lecture-cache`
- `feature/ui-chest-improvements`
- `feature/commands-setlore`
- `feature/combat-damage-title`

**Ejemplos MALOS (evitar):**
- `feature/fix` (muy genérico, ¿qué arreglas?)
- `feature/test` (no describe nada)
- `myfeature` (no sigue convención)
- `feature/todo` (¿qué cosa?)

**En PowerShell:**
```powershell
git checkout -b feature/skills-lecture-cache
```
*(Reemplaza `skills-lecture-cache` con tu tema)*

**Qué esperar:**
```
Switched to a new branch 'feature/skills-lecture-cache'
```

**En VSCode:**
- Abajo a la izquierda: ahora dice `feature/skills-lecture-cache`

---

#### 4.3 Trabajar y commitear en pequeños lotes

**Regla de oro:** commits pequeños y descriptivos > un commit gigante.

**Flujo de trabajo:**
1. Haces cambios en uno o varios archivos.
2. Cuando terminas una "unidad lógica" (ej. agregar una función, arreglar un bug), haces commit.
3. Repites.

**Opción A: Desde VSCode (recomendado para principiantes)**

1. Presiona `Ctrl+Shift+G` (Source Control).
2. Verás tus archivos modificados en "Changes".
3. Hover sobre cada archivo → click en el `+` para "stage" (preparar para commit).
   - O click en `+` en "Changes" para stage todo.
4. Arriba, en el cuadro "Message", escribe tu commit message.
   - Ejemplo: `feat: add stat registry cache`
5. Click en el botón ✓ **Commit** (arriba del cuadro).

**Opción B: Desde PowerShell**
```powershell
git add <archivo>
# o
git add .   # (stage todo)

git commit -m "feat: add stat registry cache"
```

**Tip:** haz commits frecuentes. Si algo sale mal, puedes revertir pequeñas partes fácilmente.

---

#### 4.4 Subir la rama a GitHub (primera vez)

Cuando tengas al menos 1 commit y quieras backup o compartir:

```powershell
git push -u origin feature/skills-lecture-cache
```

**Qué esperar:**
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
...
To https://github.com/<tu-usuario>/<tu-repo>.git
 * [new branch]      feature/skills-lecture-cache -> feature/skills-lecture-cache
Branch 'feature/skills-lecture-cache' set up to track remote branch ...
```

**En VSCode:**
- Verás una notificación (abajo a la derecha): "Create Pull Request"
- (No hagas click aún; lo haremos en el siguiente paso)

**Verificar en GitHub:**
1. Ve a tu repo.
2. Dropdown de ramas (arriba a la izquierda).
3. Ahora verás tu rama `feature/skills-lecture-cache`.

---

#### 4.5 Abrir Pull Request (PR)

**Opción A: Desde GitHub (recomendado para principiantes)**

1. Ve a tu repositorio en GitHub.
2. Verás un banner amarillo arriba:
   ```
   feature/skills-lecture-cache had recent pushes X minutes ago
   [Compare & pull request]
   ```
3. Click en **Compare & pull request**.
4. **IMPORTANTE:** Verifica arriba:
   ```
   base: develop  ←  compare: feature/skills-lecture-cache
   ```
   - Si dice `base: main`, **cámbialo** a `develop` en el dropdown.
5. **Título del PR:** describe QUÉ hace.
   - Ejemplo: "Add stat registry cache for lecture system"
6. **Descripción:** explica POR QUÉ.
   - Ejemplo:
     ```
     Implementa cache por jugador para evitar recalcular stats si la firma
     de equipamiento no cambió. Reduce tick overhead en ~30% en pruebas.
     ```
7. Click **Create pull request**.

**Opción B: Desde VSCode (si tienes la extensión GitHub Pull Requests)**
1. Después del push, click en la notificación "Create Pull Request".
2. Completa título y descripción.
3. **Base branch:** `develop` (verifica que NO sea `main`).
4. Create.

---

**¿Qué pasa ahora?**
- Tu compañero puede revisar el código.
- Si configuraste GitHub Actions (luego), corre checks automáticos.
- Si todo está OK: se mergea.

---

### Revisar y mergear

---

#### 4.6 Revisión del PR (si eres el revisor)

1. Ve al PR en GitHub (tab "Pull requests").
2. Click en el PR que quieres revisar.
3. Tab **Files changed** (arriba).
4. Revisa línea por línea:
   - Si algo no está claro, haz click en el número de línea + botón `+` → "Add single comment".
   - Escribe tu duda o sugerencia.
5. Arriba a la derecha: **Review changes** → elige:
   - **Comment** (solo comentario, sin aprobar ni bloquear).
   - **Approve** (todo bien, puedes mergear).
   - **Request changes** (hay problemas, no se puede mergear aún).
6. Click **Submit review**.

---

#### 4.6b Si eres el autor y te pidieron cambios

1. Vuelve a tu rama local:
   ```powershell
   git checkout feature/skills-lecture-cache
   ```
2. Haz los cambios solicitados en los archivos.
3. Commitea:
   ```powershell
   git add <archivo>
   git commit -m "fix: address review comments"
   ```
4. Push (ya no necesitas `-u` porque la rama ya existe):
   ```powershell
   git push
   ```
5. **El PR se actualiza automáticamente** con el nuevo commit.
6. Tu compañero puede revisar de nuevo.

---

#### 4.7 Mergear el PR (cuando todo está listo)

**Cuándo mergear:**
- ✅ Checks en verde (Actions pasaron; si no tienes Actions aún, ignora esto).
- ✅ Al menos 1 aprobación (si configuraste esa protección).
- ✅ No hay conflictos.
- ✅ Funciona en pruebas manuales.

**Cómo mergear:**
1. En el PR, scroll abajo al final.
2. Botón verde **Merge pull request**.
3. **Opción recomendada:** cambiar a **Squash and merge** (dropdown junto al botón).
   - Esto agrupa todos los commits de la feature en uno solo → historial más limpio.
4. Confirma mensaje de commit (puede editarlo).
5. Click **Confirm squash and merge**.

**Resultado:**
- Los cambios ahora están en `develop`.
- GitHub te sugerirá **Delete branch**: puedes confirmar (la rama ya no es necesaria).

---

#### 4.8 Limpiar ramas locales borradas

Después de mergear, tu rama `feature/*` ya no es necesaria en tu máquina.

**En PowerShell:**
```powershell
git checkout develop
git pull
git branch -d feature/skills-lecture-cache
```

**Si Git reclama "not fully merged":**
```powershell
git branch -D feature/skills-lecture-cache
```
(Fuerza el borrado; es seguro si ya mergeaste el PR.)

**Verificar:**
```powershell
git branch -a
```
No debería aparecer tu feature local, pero sí `remotes/origin/develop` y `remotes/origin/main`.

---

### Release: pasar de `develop` a `main`

---

#### 4.9 Cuándo hacer release

Cuando `develop` tiene un conjunto de features completo y **probado**, es momento de llevar a `main`.

**Checklist antes de release:**
- ✅ Todas las features mergeadas funcionan juntas (testing conjunto).
- ✅ Pruebas en un mundo de Minecraft (BP/RP carga sin errores).
- ✅ Versión en [manifest.json](Atomic%20BP/manifest.json) actualizada.
  - Ejemplo: `1.0.1` → `1.0.2` (minor) o `1.0.3` (patch).

---

#### 4.10 Crear PR de release

1. En GitHub: tab **Pull requests** → **New pull request**.
2. **Base:** `main` ← **Compare:** `develop`.
3. **Título:** `Release v1.0.2` (usa el número del manifest).
4. **Descripción:** lista de features/fixes incluidos (changelog).
   - Ejemplo:
     ```
     ## Cambios en v1.0.2
     - feat: stat registry cache
     - feat: chest UI improvements
     - fix: scoreboard initialization bug
     ```
5. Click **Create pull request**.

**Revisión:**
- Más estricta que features normales (esto va a producción).
- Idealmente, ambos revisan.
- Prueben el código de `develop` en un mundo real antes de mergear.

---

#### 4.11 Mergear y taggear

1. Merge el PR (`develop` → `main`).
   - Opción: **Merge commit** (NO squash; queremos preservar historial de features).
2. **Crear tag** (para trazabilidad):

**En PowerShell (después del merge):**
```powershell
git checkout main
git pull
git tag -a v1.0.2 -m "Release 1.0.2: stat cache + chest UI"
git push origin v1.0.2
```

**Verificar en GitHub:**
1. Tab **Releases** (o **Tags**).
2. Verás `v1.0.2` en la lista.
3. (Opcional) Click en "Create release from tag" para añadir notas detalladas.

---

### Hotfix: arreglo urgente en `main`

---

#### 4.12 Cuándo usar hotfix

Cuando algo **crítico** se rompe en `main` (producción) y no puede esperar al próximo ciclo de `develop`.

**Ejemplos:**
- Bug que crashea el servidor al iniciar.
- JSON inválido que impide cargar el pack.
- Exploit/security issue.

**NO es hotfix:**
- Features nuevas (van a `feature/*`).
- Bugs menores que pueden esperar.

---

#### 4.13 Crear hotfix

```powershell
git checkout main
git pull
git checkout -b hotfix/fix-scoreboard-crash
```

**Trabaja como en feature:**
- Cambia archivos.
- Commitea: `git commit -m "fix: prevent crash on scoreboard init"`
- Push: `git push -u origin hotfix/fix-scoreboard-crash`

---

#### 4.14 PR y merge del hotfix

1. Crear PR: `hotfix/...` → `main`.
2. Revisión rápida pero cuidadosa.
3. Merge.
4. **Tag inmediatamente** (aumenta PATCH):
   - Si estabas en `1.0.2`, ahora es `1.0.3`.
   ```powershell
   git checkout main
   git pull
   git tag -a v1.0.3 -m "Hotfix 1.0.3: fix scoreboard crash"
   git push origin v1.0.3
   ```

---

#### 4.15 Traer hotfix de vuelta a `develop`

**IMPORTANTE:** el fix debe volver a `develop` para no perderlo en el próximo release.

**Opción A: Merge `main` → `develop`**
```powershell
git checkout develop
git pull
git merge main
git push
```

**Opción B: Cherry-pick el commit específico**
```powershell
git checkout develop
git pull
git log main   # (busca el commit-id del hotfix)
git cherry-pick <commit-id-del-hotfix>
git push
```

**Verificar:**
- `develop` debe tener el fix aplicado.
- Puedes verificar en GitHub: compara `develop` con `main` y no debería mostrar el hotfix como diferencia.

---

## 5) Convenciones de commits (Conventional Commits)

**Formato:**
```
<tipo>: <descripcion-corta>
```

**Tipos comunes:**
- `feat:` nueva funcionalidad
- `fix:` arreglo de bug
- `refactor:` refactor sin cambiar comportamiento
- `chore:` mantenimiento (tooling, deps, config)
- `docs:` documentación
- `style:` formato (no cambia lógica)
- `test:` agregar/mejorar tests

**Ejemplos:**
```
feat: add stat registry cache
fix: prevent double init in lecture system
refactor: extract lore parser to shared module
chore: add eslint config
docs: update README with setup instructions
```

**Reglas de oro:**
- Un commit = un tema.
- Mensajes descriptivos (NO "update", NO "fix stuff").
- Primera línea máx 72 caracteres.

---

## 6) Versionado y releases

### Versionado semántico (SemVer)

Formato: `MAJOR.MINOR.PATCH`

**Cuándo aumentar cada número:**
- **PATCH** (`1.0.1` → `1.0.2`): bugfixes, cambios mínimos.
- **MINOR** (`1.0.2` → `1.1.0`): nuevas features compatibles.
- **MAJOR** (`1.1.0` → `2.0.0`): cambios incompatibles (breaking changes).

**Para BP/RP:**
- Alinea con `manifest.json` → `"version": [1, 0, 2]` = `v1.0.2`.

### Proceso de release (resumen)

1. PR `develop` → `main`.
2. Merge.
3. Tag: `git tag -a v1.0.2 -m "..."`
4. Push tag: `git push origin v1.0.2`
5. (Opcional) GitHub Release con changelog.

---

## 7) Checks automáticos (GitHub Actions) — PRÓXIMAMENTE

**Objetivo:** bloquear merges rotos con validaciones baratas.

**Checks recomendados:**
1. **Lint** (ESLint): errores comunes, imports, etc.
2. **Format check** (Prettier): evitar diffs por estilo.
3. **Typecheck** (JSDoc + `@ts-check`): detectar errores de tipos.
4. **Validación de JSON**: manifest/items/entities.

**Nota:** esto se configura más adelante; por ahora enfócate en el flujo de ramas/PRs.

---

## 8) Uso de Copilot (mejores prácticas)

**Copilot es excelente para:**
- Boilerplate (registries, parsers, validadores).
- Refactors mecánicos.
- Escribir JSDoc/comentarios.

**Buenas prácticas:**
1. Pedir a Copilot que escriba **primero** el test o caso de uso.
2. Revisar su output como si fuera PR de otra persona.
3. NO aceptar código que no entiendes (pedir explicación).

---

## 9) Checklist de adopción (orden recomendado)

- [ ] Crear rama `develop` desde `main` (sección 3.1).
- [ ] Subir `develop` a GitHub (sección 3.1.4).
- [ ] Activar branch protection en `main` y `develop` (sección 3.2).
- [ ] (Opcional) Cambiar default branch a `develop` (sección 3.1.5).
- [ ] Crear tu primera feature branch (sección 4.1-4.2).
- [ ] Hacer commits con convención (sección 5).
- [ ] Abrir tu primer PR (sección 4.5).
- [ ] Revisar y mergear (sección 4.6-4.7).
- [ ] Hacer tu primer release (sección 4.9-4.11).

---

## 10) Troubleshooting común

### Problema: "No puedo pushear a main"
**Solución:** Eso es correcto; las protecciones están funcionando. Debes crear PR.

### Problema: "Conflicto de merge en el PR"
**Solución:**
1. Actualiza tu rama local:
   ```powershell
   git checkout feature/...
   git fetch origin
   git merge origin/develop
   ```
2. Resuelve conflictos manualmente en los archivos.
3. Commitea y pushea:
   ```powershell
   git add .
   git commit -m "merge: resolve conflicts with develop"
   git push
   ```

### Problema: "Olvidé en qué rama estoy"
**Solución:**
```powershell
git branch
```
(La rama con `*` es la actual; o mira VSCode abajo a la izquierda.)

### Problema: "No veo mi rama en GitHub"
**Solución:** Probablemente no hiciste push. Verifica:
```powershell
git push -u origin <nombre-de-tu-rama>
```

### Problema: "Commiteé en la rama equivocada"
**Solución (si NO hiciste push):**
```powershell
git checkout <rama-correcta>
git cherry-pick <commit-id>
git checkout <rama-equivocada>
git reset --hard HEAD~1
```

---

## 11) Glosario

- **End-to-end (E2E)**: de punta a punta; implementar el flujo completo (proceso + tooling + CI), no solo describirlo.
- **GitFlow ligero**: versión simplificada con `main`, `develop`, `feature/*`, `hotfix/*`.
- **Branch protection**: reglas en GitHub que bloquean pushes directos y exigen PR/checks.
- **PR (Pull Request)**: propuesta para integrar cambios; habilita revisión y CI.
- **Merge**: integrar cambios de una rama a otra.
- **Squash and merge**: agrupar todos los commits de una rama en uno solo al mergear.
- **CI (Continuous Integration)**: automatización que valida el repo en cada PR/push.
- **Quality gate**: condición obligatoria para merge (ej. Actions en verde).
- **Lint (ESLint)**: análisis estático para detectar errores/patrones peligrosos.
- **Formatter (Prettier)**: normaliza estilo para evitar diffs por formato.
- **Typecheck**: verificación de tipos (en JS puede ser con JSDoc/TS `checkJs`).
- **SemVer**: versionado `MAJOR.MINOR.PATCH`.
- **Tag**: marca de versión en Git (ej. `v1.0.1`).
- **Hotfix**: arreglo urgente que sale desde `main`.
- **Cherry-pick**: copiar un commit específico a otra rama.
- **Upstream**: rama remota contra la que tu rama local "trackea" (`-u` configura esto).
- **Stage**: preparar archivos para commit (área "staging").
- **Commit**: guardar cambios en el historial local de Git.
- **Push**: enviar commits locales al servidor remoto (GitHub).
- **Pull**: traer commits del servidor remoto a tu rama local.
- **Conflict**: cuando Git no puede mergear automáticamente porque dos personas cambiaron lo mismo.

---

## 12) Recursos adicionales

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/) (similar a lo que estás haciendo)
- [Pro Git Book](https://git-scm.com/book/en/v2) (gratis, muy completo)
- [VSCode Git tutorial](https://code.visualstudio.com/docs/sourcecontrol/overview)

---

**¡Listo!** Con esta guía puedes empezar a trabajar de forma profesional en tu proyecto de Bedrock. Si tienes dudas en algún paso específico, revisa la sección de Troubleshooting o pregunta.
