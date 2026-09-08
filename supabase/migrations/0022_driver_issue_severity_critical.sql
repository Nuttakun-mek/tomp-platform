-- Phase H — allow 'critical' severity on driver issue reports.
--
-- driverIssueReportSchema (packages/types/schemas.ts) accepts
-- severity in ('info','warning','urgent','critical'), and <DriverTaskView>
-- sends 'critical' for safety reports — but the original check constraint only
-- allowed ('info','warning','urgent'), so every safety report failed to insert.

alter table public.driver_issue_reports
  drop constraint if exists driver_issue_reports_severity_check;

alter table public.driver_issue_reports
  add constraint driver_issue_reports_severity_check
  check (severity in ('info', 'warning', 'urgent', 'critical'));
