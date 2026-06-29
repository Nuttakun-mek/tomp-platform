# Driver Token Security

Driver QR access is assignment-scoped.

## Implemented

- Tokens are generated with cryptographic randomness.
- Raw tokens are returned only at creation time.
- Token hashes are stored server-side.
- Validation rejects missing, revoked, and expired tokens.
- Token use, creation, and revocation prepare timeline events.

## Deferred

- QR image generation.
- Token revocation management UI.
- Rate limiting and device/session fingerprinting.

