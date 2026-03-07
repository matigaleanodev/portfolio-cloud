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

Esto mantiene los contratos de despliegue cerca de los handlers reales sin introducir un repositorio de infraestructura separado.

## Superficie publica de API

La primera superficie publica del stack es una API de suscripcion expuesta mediante API Gateway HTTP API.

Rutas iniciales:

- `POST /subscriptions`
- `DELETE /subscriptions`

Estas rutas estan pensadas para ser consumidas por `portfolio`.

## Estado del trigger de release

`process-release` ya esta implementada como Lambda, pero su trigger de produccion sigue intencionalmente sin definirse.

El mecanismo de disparo debe decidirse junto con el pipeline de deploy de `portfolio` porque impacta en:

- autenticacion
- politica de reintentos
- acoplamiento entre repositorios
- visibilidad de fallos

Hasta que esa decision exista, el stack deja `process-release` desplegable pero no expuesta publicamente.

## Validacion de despliegue

El repositorio soporta actualmente dos capas de validacion antes de un deploy real:

- checks de aplicacion con `npm run ci`
- checks de infraestructura con `npm run sam:validate` y `npm run sam:build`

El despliegue real sigue requiriendo valores de AWS y de proveedores por ambiente, que no deben quedar hardcodeados en archivos versionados.
