export type AppRole = "cto" | "spooner"

export type NavItem = {
  label: string
  value: string
  count?: string
}

export type RoleWorkspace = {
  label: string
  primaryAction: string
  navItems: NavItem[]
}

export const currentUser = {
  name: "Demo User",
  email: "demo@example.com",
  initials: "DU",
  team: "Platform Operations",
}

export const roleWorkspaces: Record<AppRole, RoleWorkspace> = {
  cto: {
    label: "CTO",
    primaryAction: "Create project",
    navItems: [
      {
        label: "Overview",
        value: "overview",
        count: "6",
      },
      {
        label: "Projects",
        value: "projects",
        count: "12",
      },
      {
        label: "Employees",
        value: "employees",
        count: "84",
      },
      {
        label: "Matching",
        value: "matching",
        count: "4",
      },
      {
        label: "Documentation",
        value: "documentation",
        count: "9",
      },
    ],
  },
  spooner: {
    label: "Spooner",
    primaryAction: "Review request",
    navItems: [
      {
        label: "My Project",
        value: "my-project",
      },
      {
        label: "Requests",
        value: "requests",
        count: "1",
      },
      {
        label: "Onboarding",
        value: "onboarding",
        count: "5",
      },
      {
        label: "Offboarding",
        value: "offboarding",
        count: "3",
      },
      {
        label: "Resources",
        value: "resources",
      },
    ],
  },
}
