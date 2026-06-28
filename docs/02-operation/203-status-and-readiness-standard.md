# Status and Readiness Standard

## Status

Status describes lifecycle position, such as draft, planned, active, completed, or cancelled.

## Readiness

Readiness describes whether the operation can safely proceed.

Driver readiness checks:

- Name confirmed.
- Phone confirmed.
- Vehicle confirmed.
- Vehicle photo captured.
- Plate photo captured.
- GPS consent placeholder acknowledged.

Vehicle readiness checks:

- Vehicle type present.
- Plate number present.
- Capacity present.
- Vehicle not out of service.
- Photo evidence placeholders captured when required.

Assignment readiness checks:

- Mission exists.
- Call sign is present.
- Driver is assigned or explicitly pending.
- Vehicle is assigned or explicitly pending.
- Time window is valid.

## Risk

Risk describes operational exposure. A warning can proceed with coordinator attention. A blocker should stop publish until resolved or explicitly overridden.

## Publish Blocking Guidance

Should block publish later:

- Missing call sign.
- Invalid time window.
- Missing mission.
- Critical driver or vehicle readiness failure.

Should warn:

- Missing GPS consent placeholder.
- Missing optional photo before final readiness policy is configured.
- Pending driver or vehicle during early planning.
