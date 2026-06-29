# Photo Upload And Storage

Sprint 19 adds internal-pilot vehicle and plate photo upload foundations.

## Bucket

Primary pilot bucket: `driver-checkin-photos`.

Path pattern:

```text
project/{projectId}/assignment/{assignmentId}/vehicle-{timestamp}.jpg
project/{projectId}/assignment/{assignmentId}/plate-{timestamp}.jpg
```

## Constraints

- JPEG, PNG, and WebP only.
- 5 MB maximum file size.
- Uploads are server-side where possible.
- Service-role key must never be exposed to browser code.

## Deferred

Signed URL review, evidence gallery, moderation, and retention policies.

