# Testing Blueprint

## Test Strategy

TOMP testing must include business scenario testing, not only unit tests.

## Test Levels

1. Unit tests
2. Integration tests
3. API tests
4. Permission tests
5. Business scenario tests
6. Mobile usability tests
7. Offline/sync tests
8. Deployment smoke tests

## Initial Business Scenarios

### Scenario 001: Normal Airport Pickup

- Create project
- Create operation day
- Create airport pickup mission
- Assign call sign, driver, vehicle
- Publish plan
- Driver accesses QR
- Driver checks in
- Driver marks arrived
- Coordinator confirms boarding
- Mission completes
- Timeline contains all events

### Scenario 002: Vehicle Replacement

- Assignment is published
- Vehicle becomes unavailable
- Operation replaces vehicle
- Call sign remains same
- Assignment version created
- Driver card updates
- Timeline records change

### Scenario 003: Driver Not Ready

- Driver does not activate by deadline
- Notification sent
- Escalation occurs
- Operation replaces driver
- Timeline records action

### Scenario 004: Organizer Change

- Organizer submits time change
- Change request created
- Impact analysis identifies affected assignment
- Operation approves
- Driver and coordinator notified
- Timeline records change

### Scenario 005: GPS Lost

- Driver GPS stops updating
- Assignment GPS status becomes stale
- Operation can manually confirm status
- Mission continues

### Scenario 006: Incident and Recovery

- Driver reports vehicle problem
- Incident opens
- Recovery starts
- Vehicle replaced
- Incident resolved
- Lesson learned created
