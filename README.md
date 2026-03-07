# portfolio-cloud

[Leer en español](./README.es.md)

Serverless automation project for portfolio and blog workflows running on AWS Lambda.

## Scope

This repository contains cloud-side jobs that support content distribution, post-publication workflows, and media generation for the portfolio ecosystem.

The project currently includes these Lambdas:

- `generate-og`: generates Open Graph assets for portfolio or blog content.
- `notify-post`: sends notifications when a new post is published.
- `subscribe`: stores blog subscriptions in Cloudflare R2.
- `unsubscribe`: removes blog subscriptions from Cloudflare R2.
- `process-release`: post-deploy orchestration entrypoint that processes release manifests.

## Current Lambdas

### `generate-og`

Responsible for generating or refreshing OG images used by published content.

Expected responsibilities:

- receive blog post metadata
- build a blog-aligned OG composition
- upload the generated asset to Cloudflare R2
- return the public asset URL

### `notify-post`

Responsible for dispatching post publication notifications after a post is ready.

Expected responsibilities:

- load subscribers from R2
- transform post metadata into the blog notification template
- trigger Resend delivery for each subscriber
- remain safe for repeated executions

### `subscribe`

Responsible for persisting one subscriber per object in R2 under `subscribers/{email}.json`.

Expected responsibilities:

- validate and normalize the email
- create a subscriber object with `email` and `createdAt`
- remain idempotent when the subscriber already exists

### `unsubscribe`

Responsible for removing a subscriber object from R2.

Expected responsibilities:

- accept email from direct payloads, body payloads, or query params
- delete `subscribers/{email}.json`
- remain idempotent when the subscriber is already absent

### `process-release`

Responsible for processing the release manifest produced by the `portfolio` repository.

Expected responsibilities:

- receive the release manifest generated after deploy
- load the processed posts state from `state/posts.json`
- detect new post slugs
- invoke `generate-og` and `notify-post` for each new post
- persist the updated processed state back to R2

## Persistence Model

Current R2 objects used by the automations:

- `subscribers/{email}.json`: one object per subscriber
- `state/posts.json`: list of already processed post slugs
- `${OG_OBJECT_PREFIX}/{slug}.png`: generated OG images

Subscriber object format:

```json
{
  "email": "user@email.com",
  "createdAt": "2026-03-07T15:00:00.000Z"
}
```

Processed posts state format:

```json
[
  "arquitectura-modo-playa",
  "arquitectura-angular-real"
]
```

## Release Processing

`process-release` receives a release manifest shaped like:

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

High-level flow:

```text
portfolio deploy
  -> .generated/release-manifest.json
  -> process-release
    -> generate-og
    -> notify-post
    -> update state/posts.json
```

## Development Notes

- The project is TypeScript-based and compiles to `dist/`.
- Runtime modules should stay separated from orchestration and provider integrations.
- Lambda handlers should remain idempotent and explicit about input validation and error handling.
- Unit tests are implemented with Vitest.
- Cloud automations must stay visually aligned with `D:\Documentos\Workspace\Projects\portfolio`, which is the visual source of truth for blog-related output.

## Environment Variables

For R2, OG generation, and blog notifications, the project currently expects these variables:

- `R2_ENDPOINT`: S3-compatible R2 endpoint, for example `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_REGION`: use `auto`
- `R2_BUCKET`: target bucket for generated assets and state
- `R2_ACCESS_KEY_ID`: R2 S3 access key id
- `R2_SECRET_ACCESS_KEY`: R2 S3 secret access key
- `OG_OBJECT_PREFIX`: object prefix inside the bucket, for example `og`
- `MEDIA_BASE_URL`: public base URL used to build OG asset URLs
- `BLOG_FROM_EMAIL`: sender address used by Resend notifications
- `RESEND_API_KEY`: Resend API key for email delivery

Use `.env.example` as the local template.

## Current Structure

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

- `npm run build`: TypeScript compilation
- `npm run lint`: ESLint over source and Vitest config
- `npm test`: unit test suite with Vitest

## Status

The repository already contains blog automation flows, R2-backed subscriber persistence, release processing orchestration, and unit test coverage for the main handlers and shared helpers.
