---
id: ADR-0003
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Managed identity provider that signs users in and issues tokens; runs
  on Auth0.
kind: managed_service
split_reason: A managed backing service the project uses but does not build; the human
  asked for sign-in with a managed identity provider.
rule: Users authenticate only through Auth0; the Backend API accepts only tokens issued
  by it.
evidence:
- type: human
  ref: Auth0
basis: stated
---

## Context

The draft recorded none for this component.

## Decision

**Rule.** Users authenticate only through Auth0; the Backend API accepts only tokens issued by it.

Managed identity provider that signs users in and issues tokens; runs on Auth0.

Kept separate because A managed backing service the project uses but does not build; the human asked for sign-in with a managed identity provider..

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: Auth0
