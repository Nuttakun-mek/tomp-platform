# Business Rules v1.0

This document contains the core business rules required for the first implementation.

## Project Rules

- PRJ-001 Project is the main container for all operational data.
- PRJ-002 Project must have at least one Operation Day.
- PRJ-003 Project must have an owner.
- PRJ-004 Project must have a lifecycle status.
- PRJ-005 Archived projects are read-only.
- PRJ-006 Project may have multiple organizers.
- PRJ-007 Project may have multiple vendors.
- PRJ-008 Project must have a timeline.
- PRJ-009 Project can be cloned from previous project or template.
- PRJ-010 Project closing requires all critical incidents to be resolved.

## Operation Day Rules

- DAY-001 Every mission must belong to an operation day.
- DAY-002 Operation day must have date and timezone inherited from project unless overridden.
- DAY-003 Operation day may contain multiple sessions.
- DAY-004 Operation day requires daily briefing before live operation.
- DAY-005 Operation day requires daily closing after live operation.
- DAY-006 Operation days may be non-contiguous.

## Session Rules

- SES-001 Session is configurable and may be Morning, Airport Pickup, Conference, Dinner, etc.
- SES-002 Session can contain multiple missions.
- SES-003 Session may overlap with another session if business requires.
- SES-004 Session status does not automatically close project.

## Mission Rules

- MIS-001 Mission is a service activity, not a vehicle.
- MIS-002 Mission must have mission type.
- MIS-003 Mission must have planned time or service window.
- MIS-004 Mission should have pickup/drop-off or operational point.
- MIS-005 Mission must have service commitment.
- MIS-006 Mission may have multiple assignments.
- MIS-007 Published mission cannot be edited directly.
- MIS-008 Mission status changes must create timeline event.
- MIS-009 Mission completion requires confirmation source.
- MIS-010 Mission may be cancelled, but cancellation must preserve history.

## Assignment Rules

- ASN-001 Assignment connects mission, call sign, vehicle, driver, and time window.
- ASN-002 Assignment is the primary working unit for Driver Portal.
- ASN-003 Assignment must have call sign.
- ASN-004 Assignment may have pending driver or pending vehicle during planning.
- ASN-005 Assignment cannot overlap for same vehicle unless override is approved.
- ASN-006 Assignment cannot overlap for same driver unless override is approved.
- ASN-007 Assignment change must create version history.
- ASN-008 Replacing driver does not delete original driver history.
- ASN-009 Replacing vehicle does not change call sign.
- ASN-010 Assignment must link to commitment.

## Call Sign Rules

- CAL-001 Call sign is operational identity.
- CAL-002 Call sign is not vehicle plate.
- CAL-003 Call sign is not driver name.
- CAL-004 Call sign should remain stable during operation.
- CAL-005 Call sign may be linked to new vehicle.
- CAL-006 Call sign may be linked to new driver.
- CAL-007 QR access may be scoped to call sign assignment.
- CAL-008 Call sign must be unique within project time scope.
- CAL-009 Changing call sign after publish requires approval.

## Driver Rules

- DRV-001 Driver can access by QR, login, or access code.
- DRV-002 Driver can only see assigned scope.
- DRV-003 Driver must complete activation before operation.
- DRV-004 Driver must confirm name and phone.
- DRV-005 Driver must confirm vehicle.
- DRV-006 Driver must take vehicle photo.
- DRV-007 Driver must take plate photo.
- DRV-008 Driver should enable GPS while active.
- DRV-009 Driver must have coordinator and operation contact visible.
- DRV-010 Driver must be able to open Google Maps link.
- DRV-011 Driver issue reporting must be quick-action first.
- DRV-012 Driver UI must avoid complex menus.

## Vehicle Rules

- VEH-001 Vehicle is a resource.
- VEH-002 Vehicle must have registration/plate.
- VEH-003 Vehicle must belong to vendor or organization.
- VEH-004 Vehicle must have type and capacity.
- VEH-005 Vehicle can be replaced without changing call sign.
- VEH-006 Vehicle cannot be assigned to overlapping assignments unless override is approved.
- VEH-007 Vehicle marked out of service cannot be assigned.
- VEH-008 Vehicle readiness must include photo evidence when required.

## Coordinator Rules

- COO-001 Coordinator can access through login, QR, or invite link.
- COO-002 Coordinator can have multiple roles.
- COO-003 Coordinator can see only assigned scope.
- COO-004 Coordinator can confirm arrival.
- COO-005 Coordinator can confirm boarding.
- COO-006 Coordinator can confirm completion.
- COO-007 Coordinator can report incident or change.
- COO-008 Coordinator must see contact matrix for assigned scope.

## Organizer Rules

- ORG-001 Organizer access is optional per project.
- ORG-002 Organizer can be viewer, collaborator, or change requester.
- ORG-003 Organizer cannot directly change driver, vehicle, or assignment.
- ORG-004 Organizer change request must enter workflow.
- ORG-005 Organizer activity must be recorded.

## Publish Rules

- PUB-001 Publish creates operational baseline.
- PUB-002 Before publish, plan can be edited.
- PUB-003 After publish, changes must be change events.
- PUB-004 Publish requires conflict check.
- PUB-005 Publish requires readiness check depending on project policy.
- PUB-006 Publish creates snapshot version.
- PUB-007 Only authorized role can publish.
- PUB-008 Driver and coordinator visibility starts after publish unless preview access is granted.

## Change Rules

- CHG-001 Change after publish must have owner.
- CHG-002 Change must have reason.
- CHG-003 Change must have impact analysis.
- CHG-004 Change must identify affected mission, assignment, driver, vehicle, call sign, and commitment.
- CHG-005 Critical change requires approval.
- CHG-006 Emergency change may override but requires reason.
- CHG-007 Change must create timeline event.
- CHG-008 Affected users must be notified.

## Timeline Rules

- TIM-001 Every significant event creates timeline event.
- TIM-002 Timeline cannot be deleted.
- TIM-003 Timeline must record actor, timestamp, source, object, and event type.
- TIM-004 Data change events should record before/after when applicable.
- TIM-005 Timeline feeds audit, report, and knowledge.

## Notification Rules

- NOT-001 Notification must have action.
- NOT-002 Notification must have priority.
- NOT-003 Notification must be scoped to relevant users.
- NOT-004 Broadcast is prohibited unless approved or configured.
- NOT-005 Unresolved notification may escalate.
- NOT-006 Notification status must include sent, read, actioned, expired where applicable.

## Incident and Recovery Rules

- INC-001 Incident must have severity.
- INC-002 Incident must have owner.
- INC-003 Incident must have status.
- INC-004 Critical incident triggers recovery mode.
- INC-005 Recovery must not erase original plan.
- INC-006 Recovery must record actions and outcome.
- INC-007 Incident closure requires resolution.
- INC-008 Important incidents must create lesson learned.

## GPS Rules

- GPS-001 GPS supports operation visibility.
- GPS-002 GPS is not used as driver control tool.
- GPS-003 GPS loss does not fail mission.
- GPS-004 GPS loss enters manual confirmation mode.
- GPS-005 GPS update must link to driver, vehicle, and assignment where possible.
- GPS-006 GPS can suggest arrival but does not override human confirmation.
- GPS-007 GPS retention must be configurable.

## Knowledge Rules

- KNW-001 Every project should have closing review.
- KNW-002 Lessons learned must be linked to project.
- KNW-003 Venue notes should be reusable.
- KNW-004 Vendor performance should be recorded.
- KNW-005 Driver performance may be recorded according to privacy policy.
- KNW-006 Organizer preference should be captured.
- KNW-007 Knowledge must be searchable for future planning.
