# Business Canon

## Category

TOMP belongs to transportation operations management for event-based work.

It is distinct from:

- Fleet management systems that optimize vehicle ownership, maintenance, telematics, and utilization.
- ERP systems that manage enterprise-wide finance and resource processes.
- CRM systems that manage sales, customer relationships, and account pipelines.

## Primary Users

- Operations users who plan and run transportation work.
- Coordinators who monitor, adjust, and communicate during operation.
- Organizers who need scoped visibility into execution.
- Drivers who need temporary mobile access to assignments and navigation links.

## Jobs To Be Done

- Create an operational plan for an event transportation project.
- Assign missions to drivers, vehicles, call signs, and time windows.
- Publish a stable baseline before execution.
- Give temporary drivers QR-based access without creating full operational accounts.
- Coordinate live work from one operational truth.
- Record changes after publish.
- Review what happened after the operation ends.

## Business Rules

- A project contains missions and operational configuration.
- A mission describes service activity.
- An assignment binds mission, driver, vehicle, call sign, and time window.
- A call sign is the operating identity used during the event.
- A vehicle plate is reference data, not the operational identity.
- A published plan is the baseline for execution.
- Every post-publish mutation must be represented by a change event.
- Timeline and audit are required for trust and review.
