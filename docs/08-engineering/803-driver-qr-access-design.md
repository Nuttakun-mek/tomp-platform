# Driver QR Access Design

## Flow

1. Operation user prepares assignment.
2. System generates assignment-scoped driver access token.
3. Token is encoded into a QR-access URL.
4. Temporary driver opens Driver Card.
5. Driver confirms readiness and uses Google Maps for navigation.

## Token Security Rules

- Production token generation must be server-only.
- Tokens must be random, unguessable, and stored as hashes.
- Service-role keys must never reach browser code.
- Tokens must be scoped to project and assignment.

## Expiry And Revocation

Tokens should support:

- Expiry time.
- Revoked status.
- Assignment scope.
- Audit trail through timeline events.

## Why QR Is Necessary

Temporary drivers may not have operation-user accounts. QR access allows scoped assignment access without turning TOMP into a full driver account management system.

## Deferred

- Production token generation.
- Token validation.
- QR image generation.
- Driver activation persistence.
- Timeline writes from driver actions.
