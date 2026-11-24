# ADR Index

One line per decision — the rule, not the reasoning. Read the full ADR (`.arc/decisions/ADR-NNNN-*.md`) for context and rationale.

## Accepted — binding rules

| ADR | Category | Status | Rule |
|---|---|---|---|
| ADR-0001 | component | accepted | All business logic and database access go through the Backend API; the Web App never talks to the database directly. |
| ADR-0002 | component | accepted | Only the Backend API reads and writes the Relational Database, which runs on PostgreSQL. |
| ADR-0003 | component | accepted | Users authenticate only through Auth0; the Backend API accepts only tokens issued by it. |
| ADR-0004 | deployment_target | accepted | Deploy the Web App and Backend API as container images on AWS in one region, with no cross-region replication. |
| ADR-0005 | cross_cutting | accepted | Run all components in a single AWS region; no residency-driven placement is required. |
