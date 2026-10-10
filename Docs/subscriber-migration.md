# Private subscriber migration

## Completed production execution on 2026-10-09

Migration completed without a code deployment: 1 verified private subscriber, 0 public copies, former public HEAD 404 and original concurrency restored. Only subscribe/unsubscribe/notify-post temporarily use the private bucket for both environment bucket variables. Tomorrow deploy the new code and SAM template together with R2_BUCKET=portoflio-blog-media and SUBSCRIBERS_BUCKET=portfolio-blog-subscribers. Do not rerun migration or deploy the previous template. See the workspace Docs/operations EN/ES record. The procedure below is general reference, not pending work.

The public media bucket previously stored `subscribers/*.json`. Deploying the code alone does not remove those existing public objects. Keep the private bucket without public domains or an enabled `r2.dev` URL.

## Preparation

1. Create `portfolio-blog-subscribers` as a private R2 bucket. Grant the existing runtime credential object access to it, or configure an appropriately scoped replacement through the existing secret mechanism. Never paste credentials into commands, logs, or Git.
2. Configure `SUBSCRIBERS_BUCKET` in the ignored local `.env`. Set the GitHub variable `PORTFOLIO_CLOUD_SUBSCRIBERS_BUCKET` if choosing a different name. The runtime requires this bucket to differ from `R2_BUCKET`.
3. Confirm anonymous access is disabled in R2 settings. The S3 API cannot establish that the bucket has no public custom domain; this is an administrative check.
4. Pause subscription writes for the full copy, runtime cutover and cleanup window, including direct API Gateway access. Keep public media available. This prevents a concurrent subscribe/unsubscribe from being copied incorrectly or resurrected. Verify the pause before continuing.

## Copy and cutover

Run from the repository in WSL, using the existing Node runtime:

```sh
npm run migrate:subscribers
npm run migrate:subscribers -- --copy
```

The first command only counts source objects. The second copies missing objects, reads the destination and compares SHA-256 hashes. Existing matching copies are safe to retry; differing copies stop the operation without overwriting them. No subscriber emails or provider error details are printed.

Deploy the tested cloud code to the currently active stage, with `SubscribersBucket` pointing to the private bucket. Verify subscribe, unsubscribe and notify Lambdas all have the private environment setting and the new code. A later production-stage deployment must carry the same setting. Do not invoke real newsletter delivery as a migration test. Check persistence with an explicitly disposable test subscriber, then remove that test record through the normal endpoint.

## Remove old public copies

Only after the private runtime is active, with writes still paused:

```sh
SUBSCRIBERS_MIGRATION_CUTOVER_CONFIRMED=true npm run migrate:subscribers -- --remove-public
```

The script verifies all source objects against private copies before deleting anything, then rereads each source immediately before deleting it. Missing or different private copies stop cleanup. Confirm known old public keys return 404, and purge any existing CDN cache for those keys before resuming writes. Verify the private bucket remains inaccessible anonymously.

Rollback before cleanup can restore the previous runtime while writes are paused. After cleanup, restore a compatible runtime that keeps reading the private bucket; do not move subscriber data back into public storage.

The migration is not complete until old public URLs are inaccessible and the deployed runtime uses private storage. A local test or a prepared workflow is not production verification.
