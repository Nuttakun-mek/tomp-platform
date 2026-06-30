import type { Assignment, CallSign, Driver, Mission, Project, TimelineEvent, Vehicle } from "@tomp/types/domain";

type Row = Record<string, unknown>;

function text(row: Row, key: string, fallback = ""): string {
  return typeof row[key] === "string" ? row[key] : fallback;
}

function nullableText(row: Row, key: string): string | null {
  return typeof row[key] === "string" ? row[key] : null;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  return typeof row[key] === "number" ? row[key] : fallback;
}

function metadata(row: Row): Record<string, unknown> {
  return row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
}

export function mapProject(row: Row): Project {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    ownerProfileId: nullableText(row, "owner_profile_id"),
    projectCode: text(row, "project_code"),
    projectName: text(row, "project_name"),
    startDate: text(row, "start_date"),
    endDate: text(row, "end_date"),
    timezone: text(row, "timezone", "Asia/Bangkok"),
    status: text(row, "status", "draft") as Project["status"],
    visibilityLevel: text(row, "visibility_level", "internal"),
    serviceLevel: text(row, "service_level", "standard"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapMission(row: Row): Mission {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    projectDayId: text(row, "project_day_id"),
    sessionId: nullableText(row, "session_id"),
    missionCode: text(row, "mission_code"),
    missionName: text(row, "mission_name"),
    missionType: text(row, "mission_type"),
    priority: text(row, "priority", "normal") as Mission["priority"],
    status: text(row, "status", "draft") as Mission["status"],
    plannedStartTime: nullableText(row, "planned_start_time"),
    plannedEndTime: nullableText(row, "planned_end_time"),
    pickupVenueId: nullableText(row, "pickup_venue_id"),
    dropoffVenueId: nullableText(row, "dropoff_venue_id"),
    instruction: nullableText(row, "instruction"),
    serviceCommitment: nullableText(row, "service_commitment"),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapAssignment(row: Row): Assignment {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    missionId: text(row, "mission_id"),
    callSignId: text(row, "call_sign_id"),
    vehicleId: nullableText(row, "vehicle_id"),
    driverId: nullableText(row, "driver_id"),
    status: text(row, "status", "draft") as Assignment["status"],
    startTime: nullableText(row, "start_time"),
    endTime: nullableText(row, "end_time"),
    commitmentId: nullableText(row, "commitment_id"),
    currentVersion: numberValue(row, "current_version", 1),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapCallSign(row: Row): CallSign {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    callSign: text(row, "call_sign"),
    groupName: nullableText(row, "group_name"),
    status: text(row, "status", "active") as CallSign["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapDriver(row: Row): Driver {
  return {
    id: text(row, "id"),
    organizationId: nullableText(row, "organization_id"),
    vendorId: nullableText(row, "vendor_id"),
    fullName: text(row, "full_name"),
    phone: text(row, "phone"),
    licenseType: nullableText(row, "license_type"),
    languages: Array.isArray(row.languages) ? row.languages.filter((item): item is string => typeof item === "string") : [],
    status: text(row, "status", "available") as Driver["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapVehicle(row: Row): Vehicle {
  return {
    id: text(row, "id"),
    organizationId: nullableText(row, "organization_id"),
    vendorId: nullableText(row, "vendor_id"),
    plateNumber: text(row, "plate_number"),
    vehicleType: text(row, "vehicle_type"),
    capacity: numberValue(row, "capacity"),
    status: text(row, "status", "available") as Vehicle["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    metadata: metadata(row)
  };
}

export function mapTimelineEvent(row: Row): TimelineEvent {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    objectType: text(row, "object_type"),
    objectId: nullableText(row, "object_id"),
    eventType: text(row, "event_type"),
    actorId: nullableText(row, "actor_id"),
    source: text(row, "source", "system") as TimelineEvent["source"],
    beforeData: row.before_data && typeof row.before_data === "object" ? row.before_data as Record<string, unknown> : null,
    afterData: row.after_data && typeof row.after_data === "object" ? row.after_data as Record<string, unknown> : null,
    reason: nullableText(row, "reason"),
    createdAt: text(row, "created_at"),
    metadata: metadata(row)
  };
}
