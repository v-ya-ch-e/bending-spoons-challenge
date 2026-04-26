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
  primaryAction?: string
  navItems: NavItem[]
}

export const currentUser = {
  name: "Elena Rossi",
  email: "elena.rossi@mixingspoons.com",
  initials: "ER",
  team: "CTO",
}

export const roleWorkspaces: Record<AppRole, RoleWorkspace> = {
  cto: {
    label: "CTO",
    navItems: [
      {
        label: "Overview",
        value: "overview",
        href: "/cto/overview",
      },
      {
        label: "Companies",
        value: "projects",
        href: "/cto/projects",
        primaryAction: "Add company",
        primaryActionHref: "/cto/projects?create=1",
      },
      {
        label: "Employees",
        value: "employees",
        href: "/cto/employees",
        primaryAction: "Add employee",
        primaryActionHref: "/cto/employees?create=1",
      },
      {
        label: "Move requests",
        value: "move-requests",
        href: "/cto/move-requests",
      },
      {
        label: "Matching",
        value: "matching",
        href: "/cto/matching",
        count: "4",
        primaryAction: "Create move plan",
        primaryActionHref: "/cto/matching?create=1",
      },
      {
        label: "Documentation",
        value: "documentation",
        href: "/cto/documentation",
      },
    ],
  },
  spooner: {
    label: "Spooner",
    navItems: [
      {
        label: "My Companies",
        value: "my-project",
        href: "/spooner/my-project",
      },
      {
        label: "Requests",
        value: "requests",
        href: "/spooner/requests",
      },
      {
        label: "Onboarding",
        value: "onboarding",
        href: "/spooner/onboarding",
      },
      {
        label: "Offboarding",
        value: "offboarding",
        href: "/spooner/offboarding",
      },
    ],
  },
}
