import type { Assignment, Driver, DriverLocation, DriverNotification, Mission, Project, Vehicle } from "@tomp/types/domain";
import { getAssignmentsByProjectIds, getAssignmentsByVehicleIds } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses, type AssignmentStatusUpdate } from "@/lib/data/assignment-status";
import { getVehicleEvidenceByProjectId, type VehicleEvidence } from "@/lib/data/vehicle-evidence";
import { getDriverNotificationsByAssignmentIds } from "@/lib/data/driver-operations";
import { getLatestDriverLocations } from "@/lib/data/locations";
import { getMissionsByProjectIds } from "@/lib/data/missions";
import { getProjects } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";

export interface VehicleOperationTask {
  assignment: Assignment;
  project?: Project;
  mission?: Mission;
  driver?: Driver;
  location?: DriverLocation;
  reportedStatus?: AssignmentStatusUpdate;
  evidence?: VehicleEvidence;
  notifications: DriverNotification[];
  unreadNotifications: number;
}

export interface VehicleOperationProfile {
  vehicle: Vehicle;
  currentTasks: VehicleOperationTask[];
  remainingTasks: VehicleOperationTask[];
  completedTasks: VehicleOperationTask[];
  cancelledTasks: VehicleOperationTask[];
  latestLocation?: DriverLocation;
}

function isCurrent(status: string) {
  return ["published", "active", "operating", "ready"].includes(status);
}

function isRemaining(status: string) {
  return ["draft", "planned"].includes(status);
}

function emptyProfile(vehicle: Vehicle): VehicleOperationProfile {
  return { vehicle, currentTasks: [], remainingTasks: [], completedTasks: [], cancelledTasks: [], latestLocation: undefined };
}

// Build profiles for exactly the vehicles passed in, using only the assignments
// passed in. Callers scope `assignments` to what they need (one vehicle, one
// project, or the whole fleet) so this never over-fetches. Reference data
// (projects, drivers, latest locations) is small and cache()-deduped.
async function buildProfiles(vehicles: Vehicle[], assignments: Assignment[]): Promise<VehicleOperationProfile[]> {
  if (!vehicles.length) return [];

  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const scoped = assignments.filter((assignment) => assignment.vehicleId != null && vehicleIds.has(assignment.vehicleId));
  const projectIds = [...new Set(scoped.map((assignment) => assignment.projectId).filter(Boolean))];
  const assignmentIds = scoped.map((assignment) => assignment.id);

  const [projects, drivers, locations, missions, statusList, evidenceList, notificationsByAssignment] = await Promise.all([
    getProjects(),
    getDrivers(),
    getLatestDriverLocations(100).catch(() => [] as DriverLocation[]),
    getMissionsByProjectIds(projectIds),
    Promise.all(projectIds.map((id) => getLatestAssignmentStatuses(id).catch(() => ({} as Record<string, AssignmentStatusUpdate>)))),
    Promise.all(projectIds.map((id) => getVehicleEvidenceByProjectId(id).catch(() => ({} as Record<string, VehicleEvidence>)))),
    getDriverNotificationsByAssignmentIds(assignmentIds)
  ]);

  const reportedStatuses: Record<string, AssignmentStatusUpdate> = Object.assign({}, ...statusList);
  const evidenceByAssignment: Record<string, VehicleEvidence> = Object.assign({}, ...evidenceList);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  return vehicles.map((vehicle) => {
    const vehicleAssignments = scoped.filter((assignment) => assignment.vehicleId === vehicle.id);
    const tasks: VehicleOperationTask[] = vehicleAssignments.map((assignment) => {
      const location = locations.find((item) => item.assignmentId === assignment.id || item.vehicleId === vehicle.id);
      const notifications = notificationsByAssignment.get(assignment.id) ?? [];
      return {
        assignment,
        project: projectById.get(assignment.projectId),
        mission: assignment.missionId ? missionById.get(assignment.missionId) : undefined,
        driver: assignment.driverId ? driverById.get(assignment.driverId) : undefined,
        location,
        reportedStatus: reportedStatuses[assignment.id],
        evidence: evidenceByAssignment[assignment.id],
        notifications,
        unreadNotifications: notifications.filter((notification) => notification.status === "unread").length
      };
    });

    return {
      vehicle,
      currentTasks: tasks.filter((task) => isCurrent(task.assignment.status)),
      remainingTasks: tasks.filter((task) => isRemaining(task.assignment.status)),
      completedTasks: tasks.filter((task) => task.assignment.status === "completed"),
      cancelledTasks: tasks.filter((task) => task.assignment.status === "cancelled"),
      latestLocation: locations.find(
        (location) => location.vehicleId === vehicle.id || vehicleAssignments.some((assignment) => assignment.id === location.assignmentId)
      )
    };
  });
}

export async function getVehicleOperationProfiles(): Promise<VehicleOperationProfile[]> {
  const [projects, vehicles] = await Promise.all([getProjects(), getVehicles()]);
  const assignments = await getAssignmentsByProjectIds(projects.map((project) => project.id));
  return buildProfiles(vehicles, assignments);
}

export async function getVehicleOperationProfileById(vehicleId: string): Promise<VehicleOperationProfile | null> {
  const vehicle = (await getVehicles()).find((item) => item.id === vehicleId);
  if (!vehicle) return null;

  // Only this vehicle's assignments — the page used to build every vehicle's
  // profile across every project just to .find() one.
  const assignments = await getAssignmentsByVehicleIds([vehicleId]);
  const [profile] = await buildProfiles([vehicle], assignments);
  return profile ?? emptyProfile(vehicle);
}

export async function getVehicleOperationProfilesByProjectId(projectId: string): Promise<VehicleOperationProfile[]> {
  const assignments = await getAssignmentsByProjectIds([projectId]);
  const vehicleIds = new Set(assignments.map((assignment) => assignment.vehicleId).filter((id): id is string => Boolean(id)));
  const vehicles = (await getVehicles()).filter((vehicle) => vehicleIds.has(vehicle.id));

  const profiles = await buildProfiles(vehicles, assignments);
  return profiles.filter(
    (profile) => profile.currentTasks.length || profile.remainingTasks.length || profile.completedTasks.length || profile.cancelledTasks.length
  );
}
