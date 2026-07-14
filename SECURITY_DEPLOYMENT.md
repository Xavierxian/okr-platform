# Security Deployment Runbook

## Before deployment

1. Back up PostgreSQL outside the Git workspace and verify that the backup can be restored.
2. Generate a random `SESSION_SECRET` of at least 32 bytes and store it in the process environment.
3. Place `fullchain.pem` and `privkey.pem` outside the repository. On Linux, set the private key mode to `0600` and ownership to the PM2 service user.
4. Configure `HTTPS_CERT_PATH`, `HTTPS_KEY_PATH`, `HTTPS_PORT`, `HTTP_PORT`, and `PUBLIC_HTTPS_ORIGIN`.
5. Set `ADMIN_BOOTSTRAP_PASSWORD` only if the admin account is missing or has no password. Remove it after the first successful start.

## Database upgrade

1. Stop application writes.
2. Run `npm run db:migrate` against the target database.
3. Verify that non-admin users have `auth_provider=dingtalk` and a null password.
4. Verify objective, key-result, department, and user counts against the pre-deployment snapshot.
5. Remove all rows from the `session` table so every user authenticates again.

## Application deployment

1. Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run server:build`, and the Expo static build.
2. Start or reload with `pm2 reload okr-platform --update-env`.
3. Confirm that the HTTP port returns `308` to the configured public HTTPS origin.
4. Confirm TLS 1.0 and TLS 1.1 are rejected, the certificate chain is valid, and HSTS/security headers are present.
5. Log in through DingTalk as a normal user and by local password as the super administrator.

## Security verification

1. Repeat the report's objective-ID and `objectiveId` tampering cases and expect `404`.
2. Verify assignees can update only their own KR progress and score; collaborators remain read/comment only.
3. Verify direct access to administrator screens redirects normal users and administrator APIs return `403`.
4. Verify missing or incorrect CSRF tokens and untrusted Origins return `403`.
5. Verify sensitive changes appear in the audit-log screen without passwords, cookies, tokens, or full request bodies.

## Repository history cleanup

The tracked database dump was removed from the current tree. Rewriting shared Git history must be coordinated because it changes every commit ID. During a maintenance window, use `git filter-repo --path backup_20260304_022612.sql --invert-paths`, have all collaborators re-clone, and force-push protected branches with administrator approval. Rotate credentials before this step; history cleanup is not a substitute for rotation.

## Certificate renewal

Replace the PEM files atomically, confirm the private key remains mode `0600`, and run `pm2 reload okr-platform`. Monitor the startup log for the remaining certificate lifetime and verify the served certificate after reload.

