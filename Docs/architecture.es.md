# arquitectura de portfolio-cloud

## Proposito

Este documento define la arquitectura objetivo actual de `portfolio-cloud` como capa serverless de automatizacion dentro del ecosistema del portfolio.

Complementa el README del repositorio con decisiones de despliegue y de limites del sistema que deben mantenerse estables aunque cambie la implementacion.

## Rol en el ecosistema

`portfolio-cloud` es responsable de automatizaciones post-publicacion y workflows de distribucion que no deben vivir dentro del repositorio frontend `portfolio`.

Su alcance incluye:

- procesamiento de release manifests
- generacion de imagenes Open Graph
- notificaciones de publicacion
- publicacion del conocimiento editorial del chat
- persistencia de suscripciones del blog
- orquestacion post-deploy

`portfolio` sigue siendo la fuente de verdad editorial y visual.

## Estructura de runtime

El proyecto esta organizado alrededor de handlers Lambda y modulos compartidos de proveedores.

Dominios actuales de runtime:

- `src/lambdas/`
- `src/shared/`
- `src/dev/`

Reglas de limites esperadas:

- los handlers adaptan el input del evento y delegan la ejecucion
- la orquestacion se mantiene en servicios dedicados como `process-release`
- las integraciones con proveedores como R2 y Resend se mantienen en modulos compartidos
- la salida visual para OG y mails editoriales se mantiene alineada con `portfolio`

## Modelo de infraestructura

La infraestructura queda versionada en `template.yaml` usando AWS SAM.

El stack inicial define:

- una Lambda por cada entrypoint de automatizacion actual
- una API HTTP compartida para `subscribe` y `unsubscribe`
- una Lambda interna para publicar en R2 el artifact editorial del chat
- variables de entorno de runtime centralizadas mediante parametros del stack
- empaquetado con `esbuild` conducido por metadata de SAM

Naming actual de despliegue:

- nombre del stack para el ambiente activo: `portfolio-cloud-prod`
- patron de nombres de Lambda: `portfolio-cloud-<environment>-<service>`
- ambiente actual: `prod`
- stage reservado para pruebas: `dev`
- bucket de artifacts del ambiente activo: `portfolio-cloud-prod-artifacts-650387442642-us-east-1-an`

Target operativo de despliegue:

- los pushes a `main` deben desplegar el stage `prod`
- el workflow manual puede seguir apuntando a `dev` o `prod`
- el workflow de deploy resuelve stack y bucket de artifacts por stage en lugar de dejar `dev` hardcodeado

Esto mantiene los contratos de despliegue cerca de los handlers reales sin introducir un repositorio de infraestructura separado.

## Superficie publica de API

La primera superficie publica del stack es una API de suscripcion expuesta mediante API Gateway HTTP API.

Rutas iniciales:

- `POST /subscriptions`
- `DELETE /subscriptions`

Estas rutas estan pensadas para ser consumidas directamente por `portfolio` o mediante una fachada delgada en `portfolio-api`, mientras `portfolio-cloud` sigue siendo el owner de la persistencia de suscriptores y de la automatizacion editorial.

## Trigger de release

`process-release` se despliega como Lambda interna sin exposicion por API Gateway.

El flujo real de ejecucion es:

CI de `portfolio`
-> `aws lambda invoke`
-> `process-release`
-> `generate-og`
-> `notify-post`
-> Cloudflare R2 y Resend

Esto mantiene el trigger como una operacion privada del pipeline sin romper los limites actuales entre handler, orquestacion e integraciones.

Dentro de AWS, `process-release` orquesta las Lambdas desplegadas `generate-og` y `notify-post` mediante la Lambda Invoke API, en lugar de importar sus handlers dentro del mismo bundle.

El estado de release persistido en R2 ahora es consciente de la etapa por post. Eso permite a `process-release` guardar progreso parcial, reintentar fallos downstream de manera acotada y evitar rehacer `generate-og` o reenviar notificaciones cuando la falla estuvo en una etapa posterior.

La Lambda acepta estas dos formas de payload:

- un payload envuelto con el campo `manifest`
- el JSON crudo del release manifest generado por `portfolio`

Eso permite que el pipeline de `portfolio` invoque la funcion directamente contra `.generated/release-manifest.json` sin exponer un endpoint publico.

Ejemplo de invocacion desde CI:

```bash
aws lambda invoke \
  --function-name portfolio-cloud-dev-process-release \
  --payload file://.generated/release-manifest.json \
  response.json
```

## Handoff del artifact editorial

El conocimiento editorial del chat generado por `portfolio` se entrega como `.generated/chat/knowledge.json`.

`portfolio-cloud` pasa a ser el owner de la copia cloud canonica de ese artifact en R2 mediante la Lambda interna `publish-chat-knowledge`.

Key canonica actual del objeto:

- `artifacts/chat/knowledge.json`

El payload fuente sigue siendo el artifact editorial generado por `portfolio`, mientras que el objeto almacenado en cloud lo envuelve con metadata operativa como version de publicacion, origen, metadata de release cuando existe y hash de contenido.

Esto mantiene aislado a `process-release` del handoff del conocimiento del chat para no cargar riesgo no relacionado sobre una Lambda de release ya validada.

### Validación del contrato de conocimiento del chat

El publicador v1 exige al menos una colección projects/posts, rechaza slugs duplicados dentro de cada colección y acepta solo enlaces HTTP(S) absolutos sin credenciales embebidas. Publicar dos veces el mismo artifact escribe la misma clave y envelope; este contrato no ordena invocaciones concurrentes. La API verifica el contentHash existente sobre el objeto knowledge normalizado antes de consumir un envelope. No se requiere migración de schema.

La validación entre repos está en `portfolio-api/scripts/evaluate-chat.cjs --contract`, después de instalar los tres repos y compilar API/cloud. Ejecuta el productor del frontend en un temporal y pasa su salida por el constructor cloud y el lector API reales, sin publicar ni llamar al modelo. Regenerar cambia generatedAt y por lo tanto el hash aunque los facts editoriales no cambien.

Desplegar publicador compatible y API antes de habilitar history opcional en frontend. Recuperar facts republicando un payload anterior verificado mediante el publicador; recuperar código desplegando la versión anterior. La API puede conservar conocimiento cacheado hasta su TTL configurado o un reinicio. Ver `portfolio-api/docs/chat-audit.es.md` y su versión inglesa para evidencia de octubre de 2026, contrato, handoff frontend y límites de evaluación.

## Validacion de despliegue

El repositorio soporta actualmente dos capas de validacion antes de un deploy real:

- checks de aplicacion con `npm run ci`
- checks de infraestructura con `npm run sam:validate` y `npm run sam:build`

Para iteracion visual de la OG sin desplegar, el repositorio tambien soporta:

- `npm run dev:og:preview`

Esto escribe `og-preview.png` en la raiz del repositorio usando el mismo contrato de renderer que se despliega en AWS.

El workflow de deploy de GitHub usa un bucket dedicado de artifacts en lugar de `--resolve-s3`.

Contrato actual de deploy:

- nombre del stack: `portfolio-cloud-dev`
- bucket de artifacts: `portfolio-cloud-prod-artifacts-650387442642-us-east-1-an`
- prefijo de artifacts: `sam`
- las dependencias nativas se construyen en el runner Linux de CI mediante `sam build`
- `generate-og` usa un build dedicado de SAM makefile en lugar del camino default por metadata de esbuild
- el build custom bundela el handler y copia los paquetes runtime de `@resvg` junto con las fuentes locales IBM Plex dentro del artifact de la Lambda
- el workflow de deploy debe mantener `npm ci --include=optional` antes de `sam build`

El despliegue real sigue requiriendo valores de AWS y de proveedores por ambiente, que no deben quedar hardcodeados en archivos versionados.

## Publicación programada

`portfolio` controla el build/deploy diario (09:17 Argentina) y excluye posts futuros de los artifacts públicos. Cloud corre después del deploy exitoso de Firebase; no programa los mails por separado. `process-release` y `publish-chat-knowledge` rechazan todo el payload antes de producir efectos si algún post tiene fecha inválida o futura en `America/Argentina/Buenos_Aires`. `notify-post` aplica el mismo control cuando recibe fecha. Desplegar estas protecciones antes del cron del frontend. Se reutiliza el estado de posts procesados; una entrega parcial de mails todavía puede duplicar destinatarios al reintentar. Ver `Docs/scheduled-publication.es.md` del frontend para activación y recuperación.

## Almacenamiento privado de suscriptores

Los objetos de suscriptores usan `SUBSCRIBERS_BUCKET`, obligatorio y separado del bucket público de media `R2_BUCKET`. El runtime rechaza nombres iguales y no vuelve al almacenamiento público como fallback. SAM expone `SubscribersBucket`; el workflow usa `PORTFOLIO_CLOUD_SUBSCRIBERS_BUCKET` (por defecto `portfolio-blog-subscribers`). Las credenciales R2 necesitan acceso a objetos del bucket privado; no se debe habilitar su URL pública de desarrollo ni un dominio público.

Antes de desplegar, seguir [el procedimiento de migración](subscriber-migration.es.md). Cambiar código/configuración no elimina las copias ya públicas. Una respuesta de rechazo de Resend ahora hace fallar la notificación aunque el SDK resuelva su promesa: el post queda pendiente de reintento, sin persistir `notifiedAt`.
