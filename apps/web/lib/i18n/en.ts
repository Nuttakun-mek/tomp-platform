import type { DictionaryShape } from "./keys";
import type { th } from "./th";

export const en = {
  app: {
    productName: "TOMP",
    productDescription: "Transportation Operations Management Platform",
    workspaceLabel: "Transportation operations workspace",
    menu: "System menu",
    mainNav: "Main navigation",
    language: "Language",
    thai: "Thai",
    english: "English"
  },
  nav: {
    sections: {
      workspace: "Workspace",
      coordination: "Coordination",
      system: "System"
    },
    projects: {
      label: "Projects",
      description: "Select a project to work in",
      help: "A project is the main operating workspace. Open a project to manage dispatching, Mission Control, resources and project settings."
    },
    resources: {
      label: "Central Resources",
      description: "Organization driver and vehicle library",
      help: "Permanent driver and vehicle library used across projects. Import resources into a project as project-owned copies."
    },
    portal: {
      label: "Client View",
      description: "Read-only view for organizers or clients",
      help: "A read-only view for organizers or clients. They can see relevant project mission status and submit change requests, but cannot edit the plan directly."
    },
    superadmin: {
      label: "System Tools",
      description: "Users, permissions and platform tools",
      help: "Manage users, roles, system checks and platform tools. Intended for platform administrators only."
    }
  },
  status: {
    active: "Active",
    archived: "Archived",
    assigned: "Assigned",
    available: "Available",
    cancelled: "Cancelled",
    completed: "Completed",
    critical: "Critical",
    draft: "Draft",
    in_progress: "In progress",
    planned: "Planned",
    published: "Published",
    ready: "Ready",
    warning: "Needs attention"
  },
  fleet: {
    pageTitle: "Fleet tracking",
    pageSubtitle: "Read-only vehicle location view for this project.",
    readOnly: "Read only",
    projectCode: "Project code",
    vehiclesInProject: "Vehicles in this project",
    liveMap: "Live map",
    legend: "GPS status legend",
    callSign: "Call Sign",
    vehicle: "Vehicle",
    vehicleType: "Vehicle type",
    colour: "Colour",
    capacity: "Capacity",
    destination: "Destination",
    lastUpdate: "Last update",
    noPosition: "No position yet",
    noDestination: "No destination specified",
    noVehicle: "No vehicle assigned",
    noUnits: "No vehicles are available for this link.",
    contactControl: "Please contact the control room.",
    accessDeniedTitle: "Unable to open this fleet link",
    accessDeniedBody: "This link is unavailable, expired, or has been revoked.",
    pinTitle: "Enter fleet access PIN",
    pinBody: "This link is protected. Enter the PIN provided by the control room.",
    pinLabel: "6-digit PIN",
    pinSubmit: "Open fleet view",
    pinWrong: "The PIN is incorrect.",
    pinTooMany: "Too many failed attempts. Please wait and try again.",
    pinRequired: "Please enter the 6-digit PIN.",
    pinUnlocked: "PIN accepted.",
    showCrew: "Crew visible",
    crewHidden: "Driver names hidden",
    driverName: "Driver",
    driverHidden: "Hidden",
    updatedAutomatically: "Updates automatically while this page is visible.",
    language: "Language",
    gps: {
      live: "Live",
      idle: "Parked",
      slow: "Slow signal",
      offline: "No update",
      stopped: "Sharing off"
    }
  }
} satisfies DictionaryShape<typeof th>;
