# State Machines

## Project State

```text
Lead -> Requirement -> Planning -> Preparation -> Published -> Operating -> Closing -> Archived
```

## Mission State

```text
Draft -> Planned -> Assigned -> Published -> Ready -> Operating -> Completed -> Verified -> Closed
```

Additional terminal state:

```text
Cancelled
```

## Assignment State

```text
Assigned -> Driver Activated -> Checked In -> Ready -> Standby -> En Route to Pickup -> Arrived Pickup -> Waiting Passenger -> Passenger Onboard -> En Route to Drop-off -> Arrived Drop-off -> Completed -> Released
```

Flags:

- Delayed
- Issue
- Reassigned
- Vehicle Replaced
- Driver Replaced
- No Show

## Driver State

```text
Offline -> Available -> Assigned -> Ready -> Operating -> Break -> Finished
```

## Vehicle State

```text
Available -> Reserved -> Assigned -> Activated -> Operating -> Standby -> Released
```

Exception:

```text
Out of Service
```

## Incident State

```text
Open -> Investigating -> Recovering -> Resolved -> Closed
```

## Change Request State

```text
Draft -> Submitted -> Reviewing -> Approved -> Applied -> Rejected -> Cancelled
```

## Notification State

```text
Created -> Sent -> Delivered -> Read -> Actioned -> Expired -> Escalated
```

## Approval State

```text
Pending -> Approved -> Rejected -> Cancelled
```
