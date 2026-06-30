# Product Experience Reset

## Product Experience Statement

TOMP is a command platform for transportation operations. It must help users know what is planned, what is ready, what is operating, what is at risk, and what needs action.

The product must feel calm, reliable, and operational. It is not a generic admin dashboard, fleet maintenance tool, ERP, CRM, accounting system, or route optimization product.

## Main UX Mental Model

1. Plan: create projects, missions, operation days, and service commitments.
2. Prepare: verify drivers, vehicles, Call Signs, contacts, QR access, and readiness.
3. Publish: freeze a baseline plan when ready.
4. Operate: monitor Assignment status, GPS visibility, Timeline, and exceptions.
5. Recover: detect risk and coordinate changes without hiding the operational history.
6. Review: use Timeline and pilot notes to improve the next operation.

## Role-Based Experience

- Operation Manager: needs the overall command view, risk, readiness, and decision prompts.
- Planner: needs project workspace, missions, operation days, and publish readiness.
- Dispatcher: needs dispatch board, Call Sign, driver, vehicle, QR, and status.
- Coordinator: needs contact clarity, driver status, and exception follow-up.
- Driver: needs one mobile card, next action, route, contacts, and GPS sharing.
- Organizer Viewer: needs scoped visibility without operational control.

## UI Hierarchy

- Command Center: live operational state and decisions.
- Project Workspace: plan, prepare, publish, and change control.
- Assignment Board: dispatch lanes and readiness.
- Driver Card: mobile-first operational task view.
- Timeline: immutable operational black box.
- Readiness: blocker/warning summaries.
- Exceptions: items requiring action.

## Design Rules

- Every screen must answer one operational question.
- Do not show generic cards without decision value.
- Prioritize exception and readiness.
- Reduce text density.
- Use Thai labels.
- Avoid rough placeholder wording.
- Show “ข้อมูลตัวอย่าง” clearly when fallback/demo data is used.
