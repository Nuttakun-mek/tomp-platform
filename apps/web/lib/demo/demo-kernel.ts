import type { Assignment, CallSign, Driver, Mission, OperationDay, Project, Session, TimelineEvent, Vehicle } from "@tomp/types/domain";

const createdAt = "2026-06-29T00:00:00.000Z";
const metadata = { demo: true };

export const demoProject: Project = {
  id: "10000000-0000-4000-8000-000000000003",
  organizationId: "10000000-0000-4000-8000-000000000001",
  ownerProfileId: "10000000-0000-4000-8000-000000000002",
  projectCode: "TOMP-DEMO-001",
  projectName: "Demo Event Transportation",
  startDate: "2026-07-15",
  endDate: "2026-07-15",
  timezone: "Asia/Bangkok",
  status: "planning",
  visibilityLevel: "internal",
  serviceLevel: "standard",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoOperationDay: OperationDay = {
  id: "10000000-0000-4000-8000-000000000004",
  projectId: demoProject.id,
  operationDate: "2026-07-15",
  dayNumber: 1,
  timezone: "Asia/Bangkok",
  status: "draft",
  briefingNotes: "Demo briefing placeholder.",
  closingNotes: null,
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoSession: Session = {
  id: "10000000-0000-4000-8000-000000000005",
  projectId: demoProject.id,
  projectDayId: demoOperationDay.id,
  sessionName: "Morning Arrivals",
  sessionType: "airport_pickup",
  startTime: "2026-07-15T01:00:00.000Z",
  endTime: "2026-07-15T05:00:00.000Z",
  status: "draft",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoMission: Mission = {
  id: "10000000-0000-4000-8000-000000000006",
  projectId: demoProject.id,
  projectDayId: demoOperationDay.id,
  sessionId: demoSession.id,
  missionCode: "MIS-DEMO-001",
  missionName: "Airport pickup wave 1",
  missionType: "airport_pickup",
  priority: "normal",
  status: "draft",
  plannedStartTime: "2026-07-15T01:30:00.000Z",
  plannedEndTime: "2026-07-15T02:30:00.000Z",
  pickupVenueId: null,
  dropoffVenueId: null,
  instruction: "Meet guests at arrivals and transfer to venue.",
  serviceCommitment: "Pickup within planned service window.",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoCallSign: CallSign = {
  id: "10000000-0000-4000-8000-000000000007",
  projectId: demoProject.id,
  callSign: "A-01",
  groupName: "Arrivals",
  status: "active",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoVehicle: Vehicle = {
  id: "10000000-0000-4000-8000-000000000008",
  organizationId: demoProject.organizationId,
  vendorId: null,
  plateNumber: "DEMO-1001",
  vehicleType: "van",
  capacity: 8,
  status: "available",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoDriver: Driver = {
  id: "10000000-0000-4000-8000-000000000009",
  organizationId: demoProject.organizationId,
  vendorId: null,
  fullName: "Demo Driver",
  phone: "+66111111111",
  licenseType: "public_transport",
  languages: ["th", "en"],
  status: "available",
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoAssignment: Assignment = {
  id: "10000000-0000-4000-8000-000000000010",
  projectId: demoProject.id,
  missionId: demoMission.id,
  callSignId: demoCallSign.id,
  vehicleId: demoVehicle.id,
  driverId: demoDriver.id,
  status: "draft",
  startTime: "2026-07-15T01:30:00.000Z",
  endTime: "2026-07-15T02:30:00.000Z",
  commitmentId: null,
  currentVersion: 1,
  createdAt,
  updatedAt: createdAt,
  metadata
};

export const demoTimelineEvents: TimelineEvent[] = [
  {
    id: "10000000-0000-4000-8000-000000000012",
    projectId: demoProject.id,
    objectType: "project",
    objectId: demoProject.id,
    eventType: "demo_seed_created",
    actorId: null,
    source: "system",
    beforeData: null,
    afterData: { project_code: demoProject.projectCode },
    reason: "Demo kernel seed loaded",
    createdAt,
    metadata
  },
  {
    id: "10000000-0000-4000-8000-000000000013",
    projectId: demoProject.id,
    objectType: "assignment",
    objectId: demoAssignment.id,
    eventType: "assignment_drafted",
    actorId: null,
    source: "operation_user",
    beforeData: null,
    afterData: { call_sign: demoCallSign.callSign },
    reason: "Assignment planning placeholder",
    createdAt: "2026-06-29T00:10:00.000Z",
    metadata
  }
];

export const demoKernel = {
  projects: [demoProject],
  operationDays: [demoOperationDay],
  sessions: [demoSession],
  missions: [demoMission],
  callSigns: [demoCallSign],
  drivers: [demoDriver],
  vehicles: [demoVehicle],
  assignments: [demoAssignment],
  timelineEvents: demoTimelineEvents
};
