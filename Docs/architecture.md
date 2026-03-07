# portfolio-cloud architecture

## Purpose

This document defines the current target architecture for `portfolio-cloud` as the serverless automation layer of the portfolio ecosystem.

It complements the repository README with deployment and boundary decisions that should remain stable across implementation changes.

## Role in the ecosystem

`portfolio-cloud` is responsible for post-publication automation and delivery-side workflows that should not live inside the `portfolio` frontend repository.

Its scope includes:

- release manifest processing
- Open Graph image generation
- publication notifications
- blog subscription persistence
- post-deploy orchestration

`portfolio` remains the editorial and visual source of truth.

## Runtime structure

The project is organized around Lambda handlers and shared provider modules.

Current runtime domains:

- `src/lambdas/`
- `src/shared/`
- `src/dev/`

Expected boundary rules:

- handlers adapt event input and delegate execution
- orchestration stays in dedicated services such as `process-release`
- provider integrations such as R2 and Resend stay in shared modules
- visual output for OG and editorial mail content stays aligned with `portfolio`

## Infrastructure model

Infrastructure is versioned in `template.yaml` using AWS SAM.

The initial stack defines:

- one Lambda per current automation entrypoint
- one shared HTTP API for `subscribe` and `unsubscribe`
- centralized runtime environment variables through stack parameters
- esbuild-based packaging driven by SAM metadata

This keeps deployment contracts close to the real handlers without introducing a separate infrastructure repository.

## Public API surface

The first public surface of the stack is a subscription API exposed through API Gateway HTTP API.

Initial routes:

- `POST /subscriptions`
- `DELETE /subscriptions`

These routes are intended to be consumed by `portfolio`.

## Release trigger status

`process-release` is already implemented as a Lambda handler, but its production trigger is still intentionally undefined.

The trigger mechanism must be decided together with the `portfolio` deploy pipeline because it affects:

- authentication
- retry behavior
- coupling between repositories
- failure visibility

Until that decision is made, the stack keeps `process-release` deployable but not publicly exposed.

## Deployment validation

The repository currently supports two validation layers before a real deploy:

- application checks with `npm run ci`
- infrastructure checks with `npm run sam:validate` and `npm run sam:build`

Real deployment still requires environment-specific AWS and provider values that should not be hardcoded in versioned files.
