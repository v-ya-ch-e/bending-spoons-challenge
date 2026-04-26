# Frontend

Next.js App Router application for the Mixing Spooners demo. The UI has two
main workspaces: a CTO view for staffing decisions and a Spooner view for
employee-side transitions and project resources.

## Live Demo

- App: `https://mixing-spooners.club`
- Backend API: `https://mixing-spooners.club/api/...`
- DB API: `https://mixing-spooners.club/db-api/...`

## Product Areas

- CTO overview, company registry, employee registry, matching, move requests,
  and documentation workspace.
- Spooner picker, assigned project view, onboarding/offboarding instructions,
  and project resource/documentation pages.
- Same-origin API calls through `/api` and `/db-api`, with local rewrites in
  `next.config.ts`.

## Local Development

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. See
[local development](../docs/LOCAL_DEVELOPMENT.md) for API routing, environment
variables, and verification.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4 and shadcn-style UI primitives
- Hugeicons for iconography
- `react-markdown` and `remark-gfm` for generated documentation rendering

## References

- [Project overview](../README.md)
- [Technical overview](../docs/TECHNICAL_OVERVIEW.md)
- [Local development](../docs/LOCAL_DEVELOPMENT.md)
- [Deployment](../docs/deployment.md)
