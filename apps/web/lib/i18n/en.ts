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
  }
} as const;
