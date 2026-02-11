# Adopción de GitFlow Ligero — Inicio Rápido

Este directorio contiene dos guías para adoptar GitFlow en tu proyecto Atomic BP/RP:

## 📚 Documentos disponibles

### 1. [GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md](GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md) ⭐ **EMPIEZA AQUÍ**
**Nivel:** Primera vez / Principiante

Guía paso a paso MUY detallada con:
- ✅ Instrucciones completas para cada comando
- ✅ Qué esperar en cada paso (output exacto)
- ✅ Verificaciones en VSCode y GitHub
- ✅ Troubleshooting común
- ✅ Glosario de términos
- ✅ Ejemplos de buen/mal uso

**Úsala si:**
- Es tu primera vez con GitFlow
- Quieres entender cada paso
- Necesitas verificar que todo funciona correctamente

---

### 2. [GUIA_DESARROLLO_GITHUB_GITFLOW.md](GUIA_DESARROLLO_GITHUB_GITFLOW.md)
**Nivel:** Resumen ejecutivo / Referencia rápida

Versión condensada con:
- Principios y modelo de ramas
- Pasos resumidos (sin verificaciones detalladas)
- Convenciones y buenas prácticas
- Checklist de adopción

**Úsala si:**
- Ya leíste la guía detallada
- Necesitas recordar comandos rápidamente
- Quieres una referencia compacta

---

## 🚀 Inicio rápido (checklist)

Si estás empezando, sigue este orden:

1. [ ] Lee [GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md](GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md) **completa** (30-40 min).
2. [ ] Ejecuta **Sección 3** (migración): crea `develop` y configura protecciones.
3. [ ] Practica **Sección 4** (flujo diario): crea tu primera feature.
4. [ ] Abre tu primer Pull Request y mergea.
5. [ ] Guarda [GUIA_DESARROLLO_GITHUB_GITFLOW.md](GUIA_DESARROLLO_GITHUB_GITFLOW.md) como referencia rápida.

---

## 📁 Estructura del proyecto

```
Desarrollo/
├── Atomic BP/          # Behavior Pack
├── RP/                 # Resource Pack
├── tools/              # Scripts auxiliares
├── .gitignore          # ✅ Conflicto resuelto
├── GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md  ⭐ EMPIEZA AQUÍ
├── GUIA_DESARROLLO_GITHUB_GITFLOW.md            (referencia rápida)
└── GITFLOW_INICIO_RAPIDO.md                     (este archivo)
```

---

## 🎯 Objetivo de estas guías

**Pasar de:**
- Commits directos en `main`
- Sin revisión de código
- Conflictos frecuentes

**A:**
- Ramas `feature/*` + Pull Requests
- Revisión obligatoria (mínimo 1 aprobación)
- `main` siempre estable
- Releases ordenados con tags
- Menos errores en producción

---

## 🛠️ Herramientas que usarás

- **Git** (local): control de versiones
- **GitHub** (remoto): hosting + PRs + branch protection
- **VSCode**: editor con integración Git
- **PowerShell**: terminal para comandos Git
- **GitHub Actions** (próximamente): CI/CD para checks automáticos

---

## 💡 Consejos antes de empezar

1. **No tengas miedo de experimentar**: Git te permite deshacer casi todo.
2. **Commits pequeños y frecuentes**: mejor 10 commits pequeños que 1 gigante.
3. **Prueba en un mundo de prueba**: antes de mergear a `main`, carga BP/RP en Minecraft.
4. **Comunícate con tu compañero**: GitFlow funciona mejor con comunicación clara.
5. **Lee el glosario**: entender los términos te hará más rápido (sección 11 de la guía detallada).

---

## 🆘 Si tienes problemas

1. **Revisa sección 10 (Troubleshooting)** en [GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md](GUIA_DESARROLLO_GITHUB_GITFLOW_DETALLADA.md).
2. **Verifica que estás en la rama correcta**:
   ```powershell
   git branch
   ```
   (O mira VSCode abajo a la izquierda)
3. **Pide ayuda a tu compañero** (es para eso que trabajáis en equipo).
4. **En último caso**, siempre puedes volver a un estado conocido:
   ```powershell
   git stash        # guarda cambios temporales
   git checkout main
   git pull
   ```

---

## 📖 Siguientes pasos (después de adoptar GitFlow)

Una vez domines el flujo de ramas/PRs:
1. Añadir GitHub Actions (CI) para checks automáticos
2. Configurar ESLint + Prettier
3. Validación de JSON (manifests, items, entities)
4. TypeCheck con JSDoc
5. Automatizar releases con changelog

Pero **primero domina lo básico** (ramas + PRs). No intentes todo a la vez.

---

**¡Éxito en tu adopción de GitFlow!** 🚀
