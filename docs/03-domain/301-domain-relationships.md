# Domain Relationships

## Hierarchy

```text
Customer
  -> Project
    -> Operation Day
      -> Session
        -> Mission
          -> Assignment
            -> Commitment
            -> Call Sign
            -> Vehicle
            -> Driver
            -> Coordinator
```

## Project Relationships

Project has:

- Many operation days
- Many sessions through operation days
- Many missions
- Many assignments
- Many organizers
- Many vendors
- Many files
- Many timeline events
- Many incidents
- Many knowledge items

## Mission Relationships

Mission belongs to:

- Project
- Operation Day
- Session

Mission has:

- Many assignments
- Many commitments
- Many timeline events
- Possible incidents
- Possible change requests

## Assignment Relationships

Assignment belongs to:

- Mission
- Project

Assignment references:

- Call Sign
- Vehicle
- Driver
- Coordinator(s)
- Commitment

Assignment has:

- Version history
- Status updates
- GPS locations
- Notifications
- Timeline events

## Driver Relationships

Driver belongs to vendor or organization.

Driver has:

- Assignments
- Check-ins
- GPS locations
- Status updates
- Timeline events

## Vehicle Relationships

Vehicle belongs to vendor or organization.

Vehicle has:

- Assignments
- Check-ins
- Photos
- Documents
- Availability

## Incident Relationships

Incident belongs to project and may reference mission, assignment, driver, vehicle, call sign, venue, or organizer.

Incident may have recovery actions and lessons learned.
