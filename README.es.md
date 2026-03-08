# portfolio-cloud

[Read in English](./README.md)

Proyecto de automatizacion serverless para flujos del portfolio y del blog ejecutados en AWS Lambda.

## Alcance

Este repositorio contiene jobs del lado cloud que soportan distribucion de contenido, workflows post-publicacion y generacion de media para el ecosistema del portfolio.

El proyecto incluye actualmente estas Lambdas:

- `generate-og`: genera assets Open Graph para contenido del portfolio o del blog.
- `notify-post`: envia notificaciones cuando se publica un nuevo post.
- `publish-chat-knowledge`: publica en Cloudflare R2 el artifact editorial del chat.
- `subscribe`: guarda suscripciones del blog en Cloudflare R2.
- `unsubscribe`: elimina suscripciones del blog en Cloudflare R2.
- `process-release`: entrypoint de orquestacion post-deploy para procesar release manifests.

## Lambdas actuales

### `generate-og`

Responsable de generar o refrescar las imagenes OG usadas por el contenido publicado.

Responsabilidades esperadas:

- recibir metadata del post
- construir una composicion OG alineada al blog
- subir el asset generado a Cloudflare R2
- devolver la URL publica del asset

### `notify-post`

Responsable de despachar notificaciones de publicacion cuando un post ya esta listo.

Responsabilidades esperadas:

- cargar suscriptores desde R2
- transformar metadata del post en la plantilla de notificacion del blog
- disparar envios por Resend para cada suscriptor
- mantenerse segura para ejecuciones repetidas

### `publish-chat-knowledge`

Responsable de publicar la copia cloud canonica del conocimiento editorial del chat generado por `portfolio`.

Responsabilidades esperadas:

- aceptar el artifact editorial generado desde `.generated/chat/knowledge.json`
- validar la forma del payload ya consumido por `portfolio-api`
- envolverlo con metadata operativa de publicacion cloud
- subir el objeto canonico a Cloudflare R2

### `subscribe`

Responsable de persistir un suscriptor por objeto en R2 bajo `subscribers/{email}.json`.

Responsabilidades esperadas:

- validar y normalizar el email
- crear un objeto de suscriptor con `email` y `createdAt`
- mantenerse idempotente cuando el suscriptor ya existe

### `unsubscribe`

Responsable de eliminar un objeto de suscriptor desde R2.

Responsabilidades esperadas:

- aceptar email desde payload directo, body JSON o query params
- eliminar `subscribers/{email}.json`
- mantenerse idempotente cuando el suscriptor ya no existe

### `process-release`

Responsable de procesar el release manifest producido por el repositorio `portfolio`.

Responsabilidades esperadas:

- recibir el release manifest generado despues del deploy
- cargar el estado de posts procesados desde `state/posts.json`
- detectar slugs nuevos
- invocar `generate-og` y `notify-post` por cada post nuevo
- reintentar cada etapa downstream con una politica acotada de reintentos
- persistir progreso parcial por etapa para no regenerar OG ni reenviar notificaciones sin necesidad
- persistir el estado actualizado en R2

## Modelo de persistencia

Objetos actuales usados en R2 por las automatizaciones:

- `subscribers/{email}.json`: un objeto por suscriptor
- `state/posts.json`: estado de procesamiento por etapas para cada slug
- `artifacts/chat/knowledge.json`: envelope canonico del conocimiento editorial del chat
- `${OG_OBJECT_PREFIX}/{slug}.png`: imagenes OG generadas

Formato del objeto de suscriptor:

```json
{
  "email": "user@email.com",
  "createdAt": "2026-03-07T15:00:00.000Z"
}
```

Formato del estado de posts procesados:

```json
{
  "arquitectura-modo-playa": {
    "ogGeneratedAt": "2026-03-08T12:00:00.000Z",
    "notifiedAt": "2026-03-08T12:01:00.000Z",
    "updatedAt": "2026-03-08T12:01:00.000Z"
  },
  "arquitectura-angular-real": {
    "ogGeneratedAt": "2026-03-08T12:03:00.000Z",
    "updatedAt": "2026-03-08T12:04:00.000Z",
    "lastFailure": {
      "stage": "notify-post",
      "failedAt": "2026-03-08T12:04:00.000Z",
      "attempts": 2,
      "message": "Lambda portfolio-cloud-dev-notify-post returned 500: ..."
    }
  }
}
```

## Procesamiento de release

`process-release` recibe un release manifest con esta forma:

```json
{
  "generatedAt": "2026-03-07T15:00:00Z",
  "siteUrl": "https://matiasgaleano.dev",
  "content": {
    "posts": [
      {
        "slug": "arquitectura-modo-playa",
        "title": "Cómo diseñé la arquitectura de Modo Playa",
        "date": "2026-03-07",
        "canonicalPath": "/blog/arquitectura-modo-playa"
      }
    ]
  }
}
```

Flujo general:

```text
deploy de portfolio
  -> .generated/release-manifest.json
  -> process-release
    -> generate-og
    -> notify-post
    -> actualizar state/posts.json
```

`process-release` ahora considera un post como completamente procesado solo despues de que `notify-post` termine bien. Si `generate-og` sale bien pero `notify-post` falla, el estado guardado conserva la etapa OG y la siguiente corrida reintenta solo la notificacion.

## Publicacion del conocimiento editorial

`publish-chat-knowledge` acepta:

- el artifact editorial crudo generado por `portfolio`
- o un payload envuelto con `artifact`, `release` opcional y `source` opcional

El artifact fuente generado por `portfolio` hoy tiene esta forma:

```json
{
  "generatedAt": "2026-03-08T12:29:28.947Z",
  "projects": [],
  "posts": []
}
```

El objeto cloud canonico publicado por `portfolio-cloud` envuelve ese payload asi:

```json
{
  "version": 1,
  "generatedAt": "2026-03-08T12:29:28.947Z",
  "source": {
    "repository": "portfolio",
    "artifactPath": ".generated/chat/knowledge.json"
  },
  "contentHash": "sha256:...",
  "knowledge": {
    "generatedAt": "2026-03-08T12:29:28.947Z",
    "projects": [],
    "posts": []
  }
}
```

Esto mantiene a `portfolio` como fuente de verdad editorial y a `portfolio-cloud` como owner del handoff canonico en R2.

## Notas de desarrollo

- El proyecto usa TypeScript y compila a `dist/`.
- Los modulos de runtime deben mantenerse separados de la orquestacion y de las integraciones con proveedores.
- Los handlers de Lambda deben seguir siendo idempotentes y explicitos en validacion de entrada y manejo de errores.
- Los tests unitarios estan implementados con Vitest.
- Las automatizaciones cloud deben mantenerse alineadas visualmente con `D:\Documentos\Workspace\Projects\portfolio`, que es la fuente de verdad visual para las salidas relacionadas al blog.

## Variables de entorno

Para R2, generacion de OG y notificaciones del blog, el proyecto espera actualmente estas variables:

- `R2_ENDPOINT`: endpoint S3-compatible de R2, por ejemplo `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_REGION`: usar `auto`
- `R2_BUCKET`: bucket destino para assets y estado
- `R2_ACCESS_KEY_ID`: access key id del API S3 de R2
- `R2_SECRET_ACCESS_KEY`: secret access key del API S3 de R2
- `OG_OBJECT_PREFIX`: prefijo de objetos dentro del bucket, por ejemplo `og`
- `CHAT_KNOWLEDGE_OBJECT_KEY`: key del objeto canonico del conocimiento editorial del chat, default `artifacts/chat/knowledge.json`
- `MEDIA_BASE_URL`: base URL publica usada para construir URLs de assets OG
- `RELEASE_STAGE_MAX_ATTEMPTS`: cantidad acotada de reintentos por etapa downstream del release, default `2`
- `BLOG_FROM_EMAIL`: direccion remitente usada por Resend
- `RESEND_API_KEY`: API key de Resend para entrega de emails

Usa `.env.example` como plantilla local.

## Estructura actual

```text
src/
  lambdas/
    generate-og/
      handler.ts
    notify-post/
      handler.ts
    publish-chat-knowledge/
      handler.ts
    process-release/
      handler.ts
    subscribe/
      handler.ts
    unsubscribe/
      handler.ts
  shared/
    editorial-knowledge.ts
    email.ts
    lambda.ts
    og.ts
    s3.ts
    subscribers.ts
```

## Tooling

- `npm run build`: compilacion TypeScript
- `npm run lint`: ESLint sobre el source y la config de Vitest
- `npm test`: suite de tests unitarios con Vitest
- `npm run ci`: atajo local de validacion para lint, tests y build TypeScript
- `npm run dev:og:preview`: genera `og-preview.png` en la raiz del repositorio para iteracion visual local
- `npm run sam:validate`: valida la plantilla AWS SAM
- `npm run sam:build`: construye artifacts Lambda mediante AWS SAM y esbuild sobre el runner Linux de CI
- `npm run sam:deploy:guided`: inicia un deploy guiado de SAM para preparar un ambiente local

El workflow de deploy construye el render de OG con `@resvg/resvg-js` directamente dentro del artifact de la Lambda `generate-og`, sin un layer nativo extra. `generate-og` usa un build dedicado de SAM makefile que copia los paquetes runtime de `@resvg` y las fuentes locales IBM Plex al artifact de despliegue para mantener la imagen alineada con `portfolio`.

## Infraestructura

La infraestructura queda versionada en `template.yaml` usando AWS SAM.

Baseline actual del stack:

- una Lambda por cada entrypoint actual de automatizacion
- una API HTTP compartida para `POST /subscriptions` y `DELETE /subscriptions`
- variables de entorno compartidas pasadas mediante parametros del stack
- `process-release` desplegada como Lambda interna invocada desde CI sin endpoint publico
- `publish-chat-knowledge` desplegada como Lambda interna para el handoff del artifact editorial hacia R2
- artifacts de deploy almacenados en el bucket dedicado `portfolio-cloud-dev-artifacts`

Las notas de arquitectura del repositorio viven en `Docs/architecture.md` y `Docs/architecture.es.md`.

## Inputs de despliegue

El despliegue real sigue requiriendo valores especificos por ambiente.

Configuracion esperada actualmente en GitHub para el workflow manual de deploy:

- Secret del repositorio `AWS_ROLE_TO_ASSUME`
- Secret del repositorio `R2_ACCESS_KEY_ID`
- Secret del repositorio `R2_SECRET_ACCESS_KEY`
- Secret del repositorio `RESEND_API_KEY`
- Variable del repositorio `AWS_REGION`

Prerequisitos AWS para el flujo actual de deploy:

- bucket S3 `portfolio-cloud-dev-artifacts` en `us-east-2`

## Estado

El repositorio ya contiene flujos de automatizacion del blog, persistencia de suscriptores sobre R2, orquestacion de releases y cobertura unitaria para handlers, servicios y modulos compartidos que sostienen los contratos principales de runtime.
