# Decision Library v1.0

Decision Library captures how experienced operations people think.

## Pattern 001: Driver Not Ready

Trigger:

- Driver has not completed activation before configured readiness deadline.

Decision Steps:

1. Send driver reminder.
2. If still not ready, notify coordinator.
3. If still not ready, notify operation.
4. Check vendor supervisor.
5. Prepare replacement driver if available.
6. Enter recovery mode if commitment is at risk.

System Support:

- Readiness alert
- Driver contact button
- Vendor supervisor contact
- Replacement candidate list
- Timeline event

## Pattern 002: Vehicle Not Ready

Trigger:

- Vehicle check-in/photo/plate/GPS not completed before deadline.

Decision Steps:

1. Notify driver.
2. Notify vendor supervisor.
3. Check if vehicle is physically present.
4. Request vehicle photo or plate confirmation.
5. Prepare standby vehicle.
6. Replace vehicle if risk exceeds threshold.

## Pattern 003: Driver Cannot Be Reached

Trigger:

- Driver does not respond to call or notification.

Decision Steps:

1. Call driver.
2. Call vendor supervisor.
3. Notify coordinator if mission is near.
4. Check GPS last location.
5. Assign backup driver if commitment at risk.
6. Record incident if service is affected.

## Pattern 004: Vehicle Breakdown

Trigger:

- Driver, coordinator, vendor, or operation reports vehicle breakdown.

Decision Steps:

1. Mark vehicle out of service.
2. Open incident.
3. Identify affected assignment.
4. Find replacement vehicle by type, capacity, proximity, availability.
5. Keep call sign if possible.
6. Notify driver, coordinator, vendor, and organizer if needed.
7. Update assignment version.
8. Record recovery outcome.

## Pattern 005: Organizer Changes Time

Trigger:

- Organizer submits or communicates schedule change.

Decision Steps:

1. Create change request.
2. Identify affected missions and commitments.
3. Identify affected assignments.
4. Check vehicle and driver conflicts.
5. Determine notification scope.
6. Approve change based on severity.
7. Publish change.
8. Notify affected users.
9. Record timeline.

## Pattern 006: Passenger No Show

Trigger:

- Driver or coordinator reports passenger not present.

Decision Steps:

1. Confirm location.
2. Contact coordinator.
3. Contact organizer if needed.
4. Start waiting timer.
5. Escalate if waiting exceeds SLA.
6. Complete, reschedule, or cancel based on instruction.
7. Record result.

## Pattern 007: GPS Lost

Trigger:

- GPS has not updated within configured time.

Decision Steps:

1. Mark GPS status stale.
2. Do not fail mission.
3. Ask driver to refresh location.
4. Allow coordinator or operation manual confirmation.
5. Record location confidence as manual if used.

## Pattern 008: Heavy Traffic

Trigger:

- Driver reports traffic or system detects delay.

Decision Steps:

1. Mark assignment as risk.
2. Estimate impact on commitment.
3. Notify coordinator.
4. Consider reroute via Google Maps.
5. If delay affects next assignment, review rotation.
6. Notify organizer only if service SLA is at risk.

## Pattern 009: Heavy Rain or Weather Disruption

Trigger:

- Weather condition affects pickup/drop-off or travel.

Decision Steps:

1. Mark affected missions as risk.
2. Check venue pickup feasibility.
3. Confirm holding area.
4. Increase buffer if possible.
5. Notify coordinators.
6. Prepare recovery transport if needed.

## Pattern 010: VIP Change

Trigger:

- VIP passenger changes timing, location, vehicle, or security requirement.

Decision Steps:

1. Classify change as high or critical.
2. Assign owner.
3. Review dedicated vehicle and driver.
4. Confirm coordinator.
5. Notify only restricted scope.
6. Record timeline with appropriate privacy level.

## Pattern 011: Mission Completed by Driver Only

Trigger:

- Driver marks mission complete but coordinator has not confirmed.

Decision Steps:

1. Mark completion pending verification if policy requires.
2. Notify coordinator.
3. If no coordinator assigned, operation may verify.
4. Timeline must show source of completion.

## Pattern 012: Assignment Conflict Detected

Trigger:

- Same driver or vehicle is assigned to overlapping time windows.

Decision Steps:

1. Prevent publish unless override.
2. Show conflict detail.
3. Suggest alternative driver or vehicle.
4. Require reason if override is used.
5. Record override in timeline.

## Pattern 013: Call Sign Change Request

Trigger:

- User requests call sign change after publish.

Decision Steps:

1. Require operation manager approval.
2. Identify all affected driver cards, print cards, QR, coordinator views.
3. Regenerate QR if needed.
4. Notify affected users.
5. Record old and new call sign.

## Pattern 014: Manual Override

Trigger:

- Operation changes status or data manually due to real-world confirmation.

Decision Steps:

1. Require reason.
2. Record actor.
3. Record source of information.
4. Record before/after.
5. Create timeline event.

## Pattern 015: Project Closing

Trigger:

- Project operations complete.

Decision Steps:

1. Verify all missions completed or cancelled.
2. Verify incidents resolved or accepted.
3. Collect daily closing notes.
4. Capture lessons learned.
5. Archive project when approved.
