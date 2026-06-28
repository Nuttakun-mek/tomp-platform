# Mission Control Specification

Mission Control is the primary operations screen.

## Purpose

Mission Control helps operation staff answer:

1. What is happening now?
2. What is at risk?
3. Who needs action?
4. What must be decided next?
5. Which commitments may fail?

## Main Views

### Readiness Board

Used before operation starts.

Displays:

- Driver readiness
- Vehicle readiness
- Photo completion
- GPS active count
- Coordinator readiness
- Missing data
- High risk assignment

### Fleet Board

Used during operation.

Displays:

- Call sign
- Vehicle
- Driver
- Current assignment status
- Next assignment
- Last GPS time
- Contact actions
- Risk flag

### Timeline

Displays event stream across project or selected scope.

### Exception List

Highlights:

- Driver not ready
- Vehicle not ready
- GPS lost
- Delayed assignment
- Change pending
- Incident open
- Approval pending

### Map View

Shows latest vehicle locations.

Map is secondary, not the main control surface.

## UX Rule

Mission Control must be calm, not noisy. It should highlight exceptions, not show every normal item as urgent.
