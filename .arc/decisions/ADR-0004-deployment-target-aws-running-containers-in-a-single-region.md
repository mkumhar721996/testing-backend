---
id: ADR-0004
category: deployment_target
title: 'Deployment target: AWS, running containers in a single region (e.g. us-east-1)'
status: accepted
superseded_by: null
component_id: null
rule: Deploy the Web App and Backend API as container images on AWS in one region,
  with no cross-region replication.
decision: AWS, running containers in a single region (e.g. us-east-1); no data-residency
  requirement.
evidence:
- type: human
  ref: AWS with containers
- type: human
  ref: Single region, no residency requirement (e.g. us-east-1)
basis: stated
---

## Decision

**Rule.** Deploy the Web App and Backend API as container images on AWS in one region, with no cross-region replication.

AWS, running containers in a single region (e.g. us-east-1); no data-residency requirement.

## Evidence

Basis: stated.
- human: AWS with containers
- human: Single region, no residency requirement (e.g. us-east-1)
