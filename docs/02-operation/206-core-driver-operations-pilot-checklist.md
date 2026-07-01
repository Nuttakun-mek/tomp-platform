# Core Driver Operations Pilot Checklist

## Before Test

- Apply migrations through `0011_driver_operations_rls.sql`.
- Confirm service-role key exists only in server environment.
- Create or select one project with one mission and one assignment.
- Ensure assignment has Call Sign, driver, and vehicle.

## Test Flow

1. Generate driver QR for assignment.
2. Confirm `driver_assignment_packets` has one packet.
3. Open QR on mobile browser.
4. Confirm Driver page shows:
   - งานของคุณวันนี้
   - Assignment Packet
   - แจ้งเตือนจากศูนย์ควบคุม
   - แจ้งเปลี่ยนเส้นทาง
   - แชร์ตำแหน่ง GPS
5. Start GPS sharing.
6. Confirm `gps_locations` receives pings.
7. Confirm `driver_location_sessions` is updated.
8. Open Mission Control.
9. Confirm driver operations panel shows packet/GPS state.
10. Stop GPS sharing and confirm session status changes.

## Pass Criteria

- QR opens valid assignment.
- GPS location pings are tied to project, assignment, driver, and vehicle.
- Mission Control can identify who and which project the location belongs to.
- Timeline records start/stop sharing.

## Known Limitation

Web GPS is foreground-first. If the driver locks the screen or switches apps, the operating system may pause browser location updates. Reliable background GPS requires the future Mobile Driver App.
