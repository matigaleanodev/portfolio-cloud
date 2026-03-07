# portfolio-cloud

Proyecto de automatizacion serverless para flujos del portfolio y del blog ejecutados en AWS Lambda.

## Alcance

Este repositorio contiene jobs del lado cloud que soportan distribucion de contenido y generacion de media para el ecosistema del portfolio.

Por ahora, el proyecto incluye dos Lambdas:

- `generate-og`: genera assets Open Graph para contenido del portfolio o del blog.
- `notify-post`: envia notificaciones cuando se publica un nuevo post.

## Lambdas actuales

### `generate-og`

Responsable de generar o refrescar las imagenes OG usadas por el contenido publicado.

Responsabilidades esperadas:

- recibir metadata o identificadores del contenido
- construir el payload de generacion de imagen
- producir una salida deterministica para el post objetivo
- fallar de forma segura cuando falten assets o datos requeridos

### `notify-post`

Responsable de despachar notificaciones de publicacion cuando un post ya esta listo.

Responsabilidades esperadas:

- recibir el payload o la referencia del post publicado
- transformar el contenido al formato necesario para cada notificacion
- disparar los proveedores de notificacion configurados
- mantener retries seguros y evitar notificaciones duplicadas

## Notas de desarrollo

- El proyecto usa TypeScript y compila a `dist/`.
- Los modulos de runtime deben mantenerse separados de la orquestacion y de las integraciones con proveedores.
- Los handlers de Lambda deben seguir siendo idempotentes y explicitos en validacion de entrada y manejo de errores.

## Variables de entorno

Para generacion de OG y subida a Cloudflare R2, el proyecto espera actualmente estas variables:

- `R2_ENDPOINT`: endpoint S3-compatible de R2, por ejemplo `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_REGION`: usar `auto`
- `R2_BUCKET`: bucket destino para los assets OG generados
- `R2_ACCESS_KEY_ID`: access key id del API S3 de R2
- `R2_SECRET_ACCESS_KEY`: secret access key del API S3 de R2
- `OG_OBJECT_PREFIX`: prefijo de objetos dentro del bucket, por ejemplo `og`

Usa `.env.example` como plantilla local.

## Estructura sugerida

```text
src/
  generate-og/
    handler.ts
    service.ts
  notify-post/
    handler.ts
    service.ts
  shared/
```

## Estado

El repositorio esta en etapa inicial. Las definiciones de infraestructura, handlers y scripts de despliegue pueden agregarse de forma incremental a medida que los contratos de las Lambdas se vuelvan concretos.
