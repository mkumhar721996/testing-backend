---
id: ADR-0005
category: cross_cutting
title: 'Cross-cutting: Project constraints'
status: accepted
superseded_by: null
component_id: null
rule: Run all components in a single AWS region; no residency-driven placement is
  required.
decision: Single AWS region, no data-residency or compliance regime.
evidence:
- type: human
  ref: Single region, no residency requirement (e.g. us-east-1)
basis: stated
---

## Decision

**Rule.** Run all components in a single AWS region; no residency-driven placement is required.

Single AWS region, no data-residency or compliance regime.

## Evidence

Basis: stated.
- human: Single region, no residency requirement (e.g. us-east-1)
