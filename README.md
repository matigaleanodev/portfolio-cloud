# portfolio-cloud

Serverless automation project for portfolio and blog workflows running on AWS Lambda.

## Scope

This repository contains cloud-side jobs that support content distribution and media generation for the portfolio ecosystem.

For now, the project includes two Lambdas:

- `generate-og`: generates Open Graph assets for portfolio or blog content.
- `notify-post`: sends notifications when a new post is published.

## Current Lambdas

### `generate-og`

Responsible for generating or refreshing OG images used by published content.

Expected responsibilities:

- receive content metadata or identifiers
- build the image generation payload
- produce a deterministic output for the target post
- fail safely when required assets or data are missing

### `notify-post`

Responsible for dispatching post publication notifications after a post is ready.

Expected responsibilities:

- receive the published post payload or reference
- transform the content into notification-specific formats
- trigger the configured notification providers
- keep retries safe and avoid duplicate notifications

## Development Notes

- The project is TypeScript-based and compiles to `dist/`.
- Runtime modules should stay separated from orchestration and provider integrations.
- Lambda handlers should remain idempotent and explicit about input validation and error handling.

## Environment Variables

For OG generation and upload to Cloudflare R2, the project currently expects these variables:

- `R2_ENDPOINT`: S3-compatible R2 endpoint, for example `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_REGION`: use `auto`
- `R2_BUCKET`: target bucket for generated OG assets
- `R2_ACCESS_KEY_ID`: R2 S3 access key id
- `R2_SECRET_ACCESS_KEY`: R2 S3 secret access key
- `OG_OBJECT_PREFIX`: object prefix inside the bucket, for example `og`

Use `.env.example` as the local template.

## Suggested Structure

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

## Status

The repository is currently in bootstrap stage. Infrastructure definitions, handlers, and deployment scripts can be added incrementally as the Lambda contracts become concrete.
