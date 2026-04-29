# Documenso

Open-source DocuSign alternative. Self-hosted document signing.

## What it does

- Send PDFs to one or more recipients for signing.
- Drag-and-drop signature, date, and field placement.
- Audit trail and PDF certificate for each completed signing.
- Built on Remix (React Router 7) + tRPC + Postgres.

## Notes for OS8 users

- Documenso requires a Postgres database. The install prompts for `DATABASE_URL` — point it at any Postgres instance you control.
- A `NEXTAUTH_SECRET` is also required (generate with `openssl rand -base64 32`).
- Email is sent via Resend if you provide `RESEND_API_KEY`. Without it, all email-related features (invites, completion notifications) gracefully no-op.
- First boot runs database migrations; expect ~30s of warmup.
- Risk classified `medium` because the install spawns a Postgres-connected web service that holds executable signing state.

## Source

[github.com/documenso/documenso](https://github.com/documenso/documenso) · License: **AGPL-3.0**
