# Architecture Summary

TOMP uses a domain-driven modular monolith architecture.

## Kernel Domains

- Project
- Mission
- Assignment
- Call Sign
- Driver
- Vehicle
- Timeline
- Notification
- Incident
- Recovery
- Knowledge
- Permission

## Architecture Rules

- Keep domain services separate.
- Do not put business rules inside UI components.
- Use events for significant operational actions.
- Store timeline events for audit and knowledge.
- Use configuration for business policies.
- Start zero-cost, design for scale.
