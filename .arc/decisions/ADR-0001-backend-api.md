---
id: ADR-0001
category: component
title: Backend API
status: accepted
superseded_by: null
component_id: comp_backend_api
responsibility: Single server-side API serving the Web App; owns business logic and
  is the only writer to the Relational Database.
kind: api_service
split_reason: Server-side runtime separate from the browser client; the human asked
  for one backend API.
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: one backend API with a relational database
- component_id: comp_identity_provider
  interaction: sync
  evidence: Sign-in only, with a managed identity provider
rule: All business logic and database access go through the Backend API; the Web App
  never talks to the database directly.
evidence:
- type: human
  ref: "Yes \u2014 one backend API with a relational database"
basis: stated
---

## Context

The draft recorded none for this component.

## Decision

**Rule.** All business logic and database access go through the Backend API; the Web App never talks to the database directly.

Single server-side API serving the Web App; owns business logic and is the only writer to the Relational Database.

Kept separate because Server-side runtime separate from the browser client; the human asked for one backend API..

## Talks to

- **Relational Database** (sync) — one backend API with a relational database
- **Identity Provider** (sync) — Sign-in only, with a managed identity provider

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: Yes — one backend API with a relational database
