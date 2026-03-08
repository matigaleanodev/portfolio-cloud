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
- variables de entorno de runtime centralizadas mediante parametros del stack
- empaquetado con `esbuild` conducido por metadata de SAM

Naming actual de despliegue:

- nombre del stack para el ambiente activo: `portfolio-cloud-dev`
- patron de nombres de Lambda: `portfolio-cloud-<environment>-<service>`
- ambiente actual: `dev`
- nombre previsto del stack de produccion: `portfolio-cloud-prod`
- bucket de artifacts del ambiente activo: `portfolio-cloud-dev-artifacts`

Esto mantiene los contratos de despliegue cerca de los handlers reales sin introducir un repositorio de infraestructura separado.

## Superficie publica de API

La primera superficie publica del stack es una API de suscripcion expuesta mediante API Gateway HTTP API.

Rutas iniciales:

- `POST /subscriptions`
- `DELETE /subscriptions`

Estas rutas estan pensadas para ser consumidas por `portfolio`.

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

## Validacion de despliegue

El repositorio soporta actualmente dos capas de validacion antes de un deploy real:

- checks de aplicacion con `npm run ci`
- checks de infraestructura con `npm run sam:validate` y `npm run sam:build`

El workflow de deploy de GitHub usa un bucket dedicado de artifacts en lugar de `--resolve-s3`.

Contrato actual de deploy:

- nombre del stack: `portfolio-cloud-dev`
- bucket de artifacts: `portfolio-cloud-dev-artifacts`
- prefijo de artifacts: `sam`
- las dependencias nativas se construyen en el runner Linux de CI mediante `sam build`
- `generate-og` usa un build dedicado de SAM makefile en lugar del camino default por metadata de esbuild
- el build custom bundela el handler y copia `@resvg/resvg-js` mas el binding Linux dentro del artifact de la Lambda
- el workflow de deploy debe mantener `npm ci --include=optional` antes de `sam build`

El despliegue real sigue requiriendo valores de AWS y de proveedores por ambiente, que no deben quedar hardcodeados en archivos versionados.
