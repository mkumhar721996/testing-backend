---
id: ADR-0002
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Relational store for the application's data; runs on PostgreSQL.
kind: infrastructure
split_reason: A backing data service the project uses but does not build; the human
  asked for a relational database.
rule: Only the Backend API reads and writes the Relational Database, which runs on
  PostgreSQL.
evidence:
- type: human
  ref: PostgreSQL
basis: stated
---

## Context

The draft recorded none for this component.

## Decision

**Rule.** Only the Backend API reads and writes the Relational Database, which runs on PostgreSQL.

Relational store for the application's data; runs on PostgreSQL.

Kept separate because A backing data service the project uses but does not build; the human asked for a relational database..

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: PostgreSQL
