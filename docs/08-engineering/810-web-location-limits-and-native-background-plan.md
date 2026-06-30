# Web Location Limits and Native Background Plan

## Current Pilot Behavior

TOMP currently supports driver location sharing through the driver web app.

The web app can:

- Request browser location permission.
- Send live GPS pings while the page is active.
- Send heartbeat pings from the last known location while the page remains visible.
- Request Screen Wake Lock where the browser supports it.
- Resume location updates when the driver returns to the page.
- Mark Mission Control locations as live, slow, offline, or stopped based on the latest ping.

## Browser Limitation

Web browsers do not guarantee continuous background location updates after the driver:

- switches to another app,
- locks the screen,
- lets the browser tab sleep,
- loses mobile data,
- disables location permission,
- or allows the operating system to throttle JavaScript timers.

This is expected browser and mobile OS behavior. A web app alone cannot provide production-grade background GPS tracking.

## Internal Pilot Rule

For the current internal pilot, drivers must keep the driver web page open while sharing GPS.

Mission Control must not assume that a stale location means the driver stopped. It only means TOMP has not received a fresh ping within the configured freshness window.

## Status Semantics

- Live: latest ping is fresh.
- Slow: latest ping is old but still recent.
- Offline: no fresh update has arrived for the offline threshold.
- Stopped: the driver explicitly tapped stop sharing.

## Production Direction

If TOMP needs reliable background GPS after app switching or screen lock, Sprint planning should introduce a native or hybrid driver companion app with:

- background location permission,
- foreground service on Android,
- iOS background location mode,
- explicit user consent,
- battery and privacy controls,
- assignment-scoped token validation,
- secure upload to the existing TOMP server API,
- and clear operational status in Mission Control.

This must remain assignment-scoped and operationally transparent. TOMP uses GPS for visibility, not driver control.
