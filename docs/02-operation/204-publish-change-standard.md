# Publish and Change Standard

Before publish, the plan can be edited as a planning artifact. After publish, the published plan becomes the baseline.

## Baseline Snapshot

Publishing creates a `publish_snapshots` record. The snapshot records the project, object type, object id, reason, metadata, and snapshot payload.

## Change Requests

After publish, operational changes should be captured as `change_requests`. A change request records reason, severity, impact summary, before data, after data, and lifecycle status.

## Impact and Timeline

Every publish or change action must create or prepare a timeline event. Timeline remains the immutable operational black box. TOMP does not delete timeline events.

## Deferred

Full approval workflows, publish locking enforcement, change application side effects, and recovery workflows are deferred.

