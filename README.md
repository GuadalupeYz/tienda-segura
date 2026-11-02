# tienda-segura

Trabajo práctico de **Integración Continua / DevSecOps** de Ingeniería de Software Aplicada. Sigue la guía de clase *"Tu primer pipeline seguro"* e incluye los tres retos extra.

La aplicación es intencionalmente mínima: una API en Express que calcula el total de una compra. Lo importante es el **pipeline de GitHub Actions** que la verifica en cada pull request.

## La aplicación

| Ruta | Qué hace |
|------|----------|
| `GET /total?p=10&c=2` | Devuelve `precio × cantidad` |
| `GET /calcular?a=2&b=3` | Suma dos números |

Para ejecutarla localmente:

    npm install
    npm test        # corre los tests (node --test)
    node app.js     # levanta la API en http://localhost:3000

Con Docker:

    docker build -t tienda-segura .
    docker run -p 3000:3000 tienda-segura

## El pipeline

Archivo: [`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml). Se ejecuta en cada **pull request**, y si cualquier control falla, el PR queda en rojo.

| # | Paso | Herramienta | Qué detecta | Concepto |
|---|------|-------------|-------------|----------|
| 1 | `npm test` | node:test | Que la lógica de negocio siga funcionando | Pruebas automáticas |
| 2 | `npm audit --audit-level=high` | npm | Vulnerabilidades conocidas (CVE) en las dependencias | **SCA** |
| 3 | `semgrep scan --config auto` | Semgrep | Patrones de código inseguro (por ejemplo, `eval`) | **SAST** |
| 4 | `gitleaks-action` | Gitleaks | Claves, tokens y contraseñas en el código y el historial | **Detección de secretos** |
| 5 | `trivy config` | Trivy | Configuración insegura del `Dockerfile` | **IaC / configuración** |
| 6 | `action-baseline` | OWASP ZAP | Vulnerabilidades de la app **en ejecución** | **DAST** |

Además, `main` tiene un **ruleset** que exige el check `verificar` en verde y la rama al día para poder fusionar.

## Historial de pull requests

### Pasos 2 y 3: armar el pipeline

| PR | Qué hace | Resultado |
|----|----------|-----------|
| [#1](https://github.com/GuadalupeYz/tienda-segura/pull/1) | Primer pipeline: solo `npm ci` y `npm test` | ✅ fusionado |
| [#2](https://github.com/GuadalupeYz/tienda-segura/pull/2) | Agrega `npm audit`, Semgrep y Gitleaks | ❌ → ✅ fusionado (ver "Problemas resueltos") |

### Paso 4: plantar cuatro fallas, cada una en su rama

| PR | Falla plantada | Control que la detectó | Corrección (paso 5) | Resultado |
|----|----------------|------------------------|---------------------|-----------|
| [#3](https://github.com/GuadalupeYz/tienda-segura/pull/3) | Token con formato de GitHub (inventado) en `app.js` | **Gitleaks** | Ninguna: el token queda en el historial | 🔒 cerrado sin fusionar, rama borrada |
| [#4](https://github.com/GuadalupeYz/tienda-segura/pull/4) | Ruta que ejecuta `eval(req.query.expr)` | **Semgrep** | `Number(a) + Number(b)` | ❌ → ✅ fusionado |
| [#5](https://github.com/GuadalupeYz/tienda-segura/pull/5) | `lodash@4.17.15`, con vulnerabilidades publicadas | **npm audit** | `npm uninstall lodash` (no se usaba) | ❌ → ✅ fusionado |
| [#6](https://github.com/GuadalupeYz/tienda-segura/pull/6) | Signo del descuento cambiado: `(1 + desc)` | **npm test** (esperaba 100, recibió 300) | Volver a `(1 - desc)` | ❌ → ✅ fusionado |

**Por qué el secreto se trata distinto:** borrar la línea en un commit nuevo no alcanza, porque el token sigue en el historial de Git y Gitleaks revisa todos los commits del PR. Se cierra el PR sin fusionar: como nunca llegó a `main`, no se publicó. En un caso real, además, hay que **revocar la clave** y generar otra.

### Retos extra

| Reto | PR | Qué se hizo | Resultado |
|------|----|-------------|-----------|
| 1. Exigir el pipeline para fusionar | (configuración) | Ruleset en `main` con *Require status checks to pass* sobre `verificar` | Con el pipeline en rojo, el botón de merge queda bloqueado (se ve en el #8) |
| 2. Escanear el contenedor con Trivy | [#7](https://github.com/GuadalupeYz/tienda-segura/pull/7) | `Dockerfile` + `trivy config` | ❌ el contenedor corría como **root** → se agregó `USER node` → ✅ |
| 3. DAST con OWASP ZAP | [#8](https://github.com/GuadalupeYz/tienda-segura/pull/8) | Levanta la app en el pipeline y la escanea con ZAP | ❌ 6 avisos de headers → helmet y headers propios → ✅ |

## Problemas resueltos (no previstos en la guía)

1. **Semgrep marcó las acciones con tags mutables** (`@v4`, `@v2`). Un tag lo puede mover su dueño; si le comprometen la cuenta, el pipeline ejecutaría código malicioso (ataque a la cadena de suministro, como pasó con `trivy-action`). **Solución:** fijar cada acción a un **commit SHA** y dejar la versión en un comentario. Por lo mismo, la imagen de Trivy usa una versión fija (`0.75.0`) y no `latest`.
2. **Semgrep pidió protección CSRF.** Es un **falso positivo** en este contexto: CSRF solo afecta a apps que usan cookies o sesiones, y esta API no tiene ninguna de las dos y solo expone rutas `GET`. **Solución:** `nosemgrep` en esa línea, con un comentario que explica por qué.
3. **El contenedor corría como root.** Lo detectó Semgrep incluso antes de que corriera Trivy. **Solución:** `USER node` en el `Dockerfile`.
4. **`app.listen` colgaba los tests.** Si el servidor arranca al importar `app.js`, `node --test` nunca termina. **Solución:** arrancar solo cuando se ejecuta directamente (`if (require.main === module)`).
5. **ZAP encontró 6 avisos** en la app en ejecución: `X-Powered-By` revelaba Express, faltaban `X-Content-Type-Options`, CSP completa, `Permissions-Policy` y `Cross-Origin-Resource-Policy`, y las respuestas eran cacheables. **Solución:** [helmet](https://helmetjs.github.io/) con una CSP estricta para una API JSON (`default-src 'none'`), `Permissions-Policy`, `Cache-Control: no-store` y un 404 propio en JSON (el 404 por defecto de Express pisaba los headers).
6. **ZAP siguió marcando la regla 10049** (*Storable / Non-Storable Content*). Es **informativa**: reporta tanto si la respuesta se cachea como si no. **Solución:** ignorarla en [`.zap/rules.tsv`](.zap/rules.tsv) con la justificación escrita.

## ¿Qué falla habría llegado a producción sin el pipeline?

Todas. El código con el secreto, con `eval`, con lodash vulnerable o con el contenedor como root **funciona**: la app responde y nadie lo nota a simple vista. Solo el test roto habría dado un resultado incorrecto visible, y quizás tarde. Por eso conviene automatizar estos controles en cada pull request y no fusionar si fallan.
