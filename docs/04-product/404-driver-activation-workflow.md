# Driver Activation Workflow

Driver activation supports temporary drivers through QR access and a mobile-friendly Driver Card.

## Flow

1. Operation team prepares assignment and call sign.
2. Driver receives QR link.
3. Driver opens Driver Card.
4. Driver confirms name, phone, vehicle, GPS consent placeholder, vehicle photo placeholder, and plate photo placeholder.
5. Driver can send status updates: Ready, Arrived Pickup, Passenger Onboard, Completed.
6. Driver can report an issue.

## Persisted in Sprint 12

When Supabase is configured, driver check-in, vehicle check-in, assignment status update, and driver issue report rows are inserted by server actions. Each write creates or prepares a timeline event.

## Deferred

Production token validation, token revocation UI, photo upload to Supabase Storage, live GPS streaming, and native mobile apps are deferred.

