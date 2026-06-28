# ADR 0002: Use Supabase as Initial Backend Platform

## Status

Accepted.

## Context

TOMP needs authentication, Postgres, authorization policies, realtime capabilities, and a low-cost launch path.

## Decision

Use Supabase as the initial backend platform.

## Consequences

- The product can launch with low infrastructure cost.
- Postgres remains the source of operational truth.
- Row Level Security should be treated as part of the access model.
- Supabase-specific usage should be documented to reduce accidental lock-in.
