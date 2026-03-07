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
