# portfolio-cloud

[Read in English](./README.md)

Proyecto de automatizacion serverless para flujos del portfolio y del blog ejecutados en AWS Lambda.

## Alcance

Este repositorio contiene jobs del lado cloud que soportan distribucion de contenido, workflows post-publicacion y generacion de media para el ecosistema del portfolio.

El proyecto incluye actualmente estas Lambdas:

- `generate-og`: genera assets Open Graph para contenido del portfolio o del blog.
- `notify-post`: envia notificaciones cuando se publica un nuevo post.
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
- persistir el estado actualizado en R2

## Modelo de persistencia

Objetos actuales usados en R2 por las automatizaciones:

- `subscribers/{email}.json`: un objeto por suscriptor
- `state/posts.json`: lista de slugs de posts ya procesados
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
[
  "arquitectura-modo-playa",
  "arquitectura-angular-real"
]
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
- `MEDIA_BASE_URL`: base URL publica usada para construir URLs de assets OG
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
    process-release/
      handler.ts
    subscribe/
      handler.ts
    unsubscribe/
      handler.ts
  shared/
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

## Estado

El repositorio ya contiene flujos de automatizacion del blog, persistencia de suscriptores sobre R2, orquestacion de releases y cobertura unitaria para handlers y helpers principales.
