import type { Assignment, Driver, DriverLocation, DriverNotification, Mission, Project, Vehicle } from "@tomp/types/domain";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses, type AssignmentStatusUpdate } from "@/lib/data/assignment-status";
import { getVehicleEvidenceByProjectId, type VehicleEvidence } from "@/lib/data/vehicle-evidence";
import { getDriverNotificationsByAssignmentId } from "@/lib/data/driver-operations";
import { getLatestDriverLocations } from "@/lib/data/locations";
import { getMissionsByProjectId } from "@/lib/data/missions";
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

export async function getVehicleOperationProfiles(): Promise<VehicleOperationProfile[]> {
  const [projects, vehicles, drivers, locations] = await Promise.all([
    getProjects(),
    getVehicles(),
    getDrivers(),
    getLatestDriverLocations(100).catch(() => [])
  ]);
  const assignmentsByProject = await Promise.all(projects.map((project) => getAssignmentsByProjectId(project.id)));
  const missionsByProject = await Promise.all(projects.map((project) => getMissionsByProjectId(project.id)));
  const statusesByProject = await Promise.all(projects.map((project) => getLatestAssignmentStatuses(project.id).catch(() => ({}))));
  const evidenceByProject = await Promise.all(projects.map((project) => getVehicleEvidenceByProjectId(project.id).catch(() => ({}))));
  const assignments = assignmentsByProject.flat();
  const missions = missionsByProject.flat();
  const reportedStatuses: Record<string, AssignmentStatusUpdate> = Object.assign({}, ...statusesByProject);
  const evidenceByAssignment: Record<string, VehicleEvidence> = Object.assign({}, ...evidenceByProject);

  return Promise.all(vehicles.map(async (vehicle) => {
    const vehicleAssignments = assignments.filter((assignment) => assignment.vehicleId === vehicle.id);
    const notificationLists = await Promise.all(vehicleAssignments.map((assignment) => getDriverNotificationsByAssignmentId(assignment.id)));
    const tasks = vehicleAssignments.map((assignment, index) => {
      const location = locations.find((item) => item.assignmentId === assignment.id || item.vehicleId === vehicle.id);
      const notifications = notificationLists[index] || [];
      return {
        assignment,
        project: projects.find((project) => project.id === assignment.projectId),
        mission: missions.find((mission) => mission.id === assignment.missionId),
        driver: drivers.find((driver) => driver.id === assignment.driverId),
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
      latestLocation: locations.find((location) => location.vehicleId === vehicle.id || vehicleAssignments.some((assignment) => assignment.id === location.assignmentId))
    };
  }));
}

export async function getVehicleOperationProfileById(vehicleId: string): Promise<VehicleOperationProfile | null> {
  const profiles = await getVehicleOperationProfiles();
  const found = profiles.find((profile) => profile.vehicle.id === vehicleId);
  if (found) return found;

  // Vehicle exists but has no operational history yet — still show its profile.
  const vehicle = (await getVehicles()).find((item) => item.id === vehicleId);
  if (!vehicle) return null;
  return { vehicle, currentTasks: [], remainingTasks: [], completedTasks: [], cancelledTasks: [], latestLocation: undefined };
}

export async function getVehicleOperationProfilesByProjectId(projectId: string): Promise<VehicleOperationProfile[]> {
  const profiles = await getVehicleOperationProfiles();
  return profiles
    .map((profile) => {
      const currentTasks = profile.currentTasks.filter((task) => task.assignment.projectId === projectId);
      const remainingTasks = profile.remainingTasks.filter((task) => task.assignment.projectId === projectId);
      const completedTasks = profile.completedTasks.filter((task) => task.assignment.projectId === projectId);
      const cancelledTasks = profile.cancelledTasks.filter((task) => task.assignment.projectId === projectId);
      return { ...profile, currentTasks, remainingTasks, completedTasks, cancelledTasks };
    })
    .filter((profile) => profile.currentTasks.length || profile.remainingTasks.length || profile.completedTasks.length || profile.cancelledTasks.length);
}
