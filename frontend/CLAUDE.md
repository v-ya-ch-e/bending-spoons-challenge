# Frontend Agent Guidelines

This file defines frontend-specific guidance for AI/code agents working in `frontend/`.
It extends (does not replace) root guidance in [`../CLAUDE.md`](../CLAUDE.md).

## Mission for Frontend Work

Build a demo-ready internal platform UI that makes staffing and transitions easy to understand:
- CTO flow: project need -> requirements -> matching -> move request
- Employee flow: request review -> onboarding/offboarding -> project resources

Favor clarity, speed, and explainability over feature depth.

## Product and UX Priorities

- Keep interactions goal-focused; one primary action per screen.
- Optimize for "quick comprehension" in key dashboards and detail pages.
- Preserve a minimal visual style (clean layout, restrained accents, subtle motion).
- Make recommendations explainable (show "why this match" in plain language).

## Scope Guardrails

- Prioritize demo-critical screens and shared primitives.
- Use mock/seed data and simulated integrations when real integrations are not required.
- Avoid speculative features (advanced analytics, heavy settings, enterprise permissions).

## Technical Conventions

- Stack: Next.js App Router + React + TypeScript + Tailwind + shadcn/ui.
- Prefer existing shadcn/ui components and composition over custom bespoke widgets.
- Keep components small and reusable only when reuse is obvious.
- Use Framer Motion sparingly (state transitions and progressive reveal only).

## Next.js Version Warning

This repository may use Next.js behavior that differs from model assumptions.
Before implementation, verify APIs and conventions against local docs in:

`node_modules/next/dist/docs/`

Follow deprecations and current file/route conventions from those docs.
