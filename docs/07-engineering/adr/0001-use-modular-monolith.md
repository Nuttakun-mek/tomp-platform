# ADR 0001: Use Modular Monolith Architecture

## Status

Accepted.

## Context

TOMP needs clear domain boundaries, but the initial team and product should move quickly without distributed system overhead.

## Decision

Build TOMP as a modular monolith with explicit module boundaries and shared platform infrastructure.

## Consequences

- Deployment and local development stay simple.
- Domain boundaries remain visible and testable.
- Future extraction remains possible if scale requires it.
- Engineers must avoid cross-module shortcuts that weaken the architecture.
