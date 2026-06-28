# Sprint 2 and 3 Product Notes

## Assignment / Call Sign / Driver Card Scope

Sprint 2 establishes UI and type foundations for assignments, call signs, vehicles, drivers, and the driver card. Assignment remains the operating unit that connects mission, call sign, vehicle, driver, and time window.

Driver Card foundation shows:

- Project name placeholder.
- Call sign.
- Assignment status.
- Pickup and drop-off placeholders.
- Commitment time placeholder.
- Coordinator and operation phone placeholders.
- Google Maps link placeholder.
- Ready, navigation, issue, and call actions.

## Implemented As UI Only

- Assignment planning board.
- Create assignment form.
- Resource pages for drivers and vehicles.
- Driver demo route and token route.
- Mission Control readiness, fleet, exception, timeline, and map placeholders.
- Timeline feed with sample immutable events only.

## Deliberately Deferred

- Supabase live reads and writes.
- Driver QR token validation.
- Live GPS streaming.
- Incident and recovery workflows.
- Analytics, AI, customer portal, vendor portal, accounting, CRM, payroll, and fleet maintenance.
- Project-scoped RBAC beyond temporary development RLS placeholders.

## Alignment With Product Constitution

The work keeps TOMP focused on transportation operations management rather than fleet management, ERP, or CRM. It reinforces Project as container, Mission as service activity, Assignment as operational work unit, Call Sign as operational identity, and Timeline as the immutable operational record.
