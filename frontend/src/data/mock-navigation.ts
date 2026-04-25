export type AppRole = "cto" | "spooner"

export type NavItem = {
  label: string
  value: string
  href: string
  count?: string
  primaryAction?: string
  primaryActionHref?: string
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
        href: "/cto/overview",
        count: "6",
      },
      {
        label: "Projects",
        value: "projects",
        href: "/cto/projects",
        count: "12",
      },
      {
        label: "Employees",
        value: "employees",
        href: "/cto/employees",
        count: "84",
        primaryAction: "Add employee",
        primaryActionHref: "/cto/employees?create=1",
      },
      {
        label: "Matching",
        value: "matching",
        href: "/cto/matching",
        count: "4",
      },
      {
        label: "Documentation",
        value: "documentation",
        href: "/cto/documentation",
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
        href: "/spooner/my-project",
      },
      {
        label: "Requests",
        value: "requests",
        href: "/spooner/requests",
        count: "1",
      },
      {
        label: "Onboarding",
        value: "onboarding",
        href: "/spooner/onboarding",
        count: "5",
      },
      {
        label: "Offboarding",
        value: "offboarding",
        href: "/spooner/offboarding",
        count: "3",
      },
      {
        label: "Resources",
        value: "resources",
        href: "/spooner/resources",
      },
    ],
  },
}
