# UI/UX Plan — Internal Talent, Project & Documentation OS

## 1. Product framing

We are designing a clean internal platform for Bending Spoons that helps leadership dynamically staff projects and helps employees transition between projects with clear onboarding/offboarding support.

The UI should feel like a premium internal operating system, not an HR dashboard. It should be minimal, fast to understand, and demo-friendly.

Core platform areas:

1. CTO workspace
2. Employee workspace
3. Project registry
4. Employee registry
5. Project creation and matching flow
6. Documentation and resource hub
7. Onboarding/offboarding task flows

The interface should be simple enough for a hackathon demo but polished enough to feel like something Bending Spoons could actually use internally.

---

## 2. Frontend tech stack

### Core stack

- React
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Specific shadcn preset to be applied globally
- Hugeicons for icons
- Recharts for simple charts if needed
- React Hook Form + Zod for forms if time allows
- Framer Motion for minimal, purposeful transitions

### UI implementation principle

Use out-of-the-box shadcn components as much as possible:

- Card
- Button
- Badge
- Avatar
- Tabs
- Table
- Dialog
- Sheet
- Dropdown Menu
- Select
- Command
- Progress
- Separator
- Tooltip
- Alert
- Accordion
- Scroll Area
- Skeleton
- Form

Avoid custom complex components unless they are central to the demo.

Use Framer Motion only where it improves clarity or makes the demo feel polished. Animations should be minimal, fast, and functional. They should never slow the user down or distract from the workflow.

---

## 3. Visual direction

## Style

Minimal, sharp, premium, operational.

The platform should mostly use:

- White backgrounds
- Black text
- Soft gray surfaces
- One or two accent colors
- Small colored status indicators
- Clean typography
- Large rounded cards
- Subtle borders
- Minimal shadows

## Colors

Base palette:

- Background: white / near-white
- Text: black / near-black
- Muted surfaces: light gray
- Borders: soft gray
- Primary accent: Bending Spoons-inspired blue/purple gradient accent
- Secondary accent: green for healthy/accepted states
- Warning accent: amber/orange
- Risk accent: red

Use accent colors sparingly. Most of the interface should stay monochrome.

## Brand usage

Use Bending Spoons branding lightly:

- Small Bending Spoons logo in the app shell/sidebar/header
- Product/company logos only in project cards where helpful
- Do not overload the UI with brand graphics
- Use logos as recognition anchors, not decoration

Potential portfolio/project logos for demo cards:

- Evernote
- WeTransfer
- Vimeo
- Remini
- Meetup
- Eventbrite

If logos are unavailable or inconvenient, use clean text avatars or generated initials instead.

---

## 4. App structure

Use a simple two-role structure:

1. CTO / admin view
2. Spooner / employee view

For the demo, role switching lives in the profile menu. The Spooner view also has an employee picker so the demo can switch between seeded employees without authentication.

### Global app shell

Use one main layout:

- Left sidebar navigation on desktop
- Top header with current workspace, role switcher, and user avatar
- Main content area with max-width container
- Optional breadcrumbs on detail pages

### Sidebar navigation

For CTO:

- Overview
- Projects
- Employees
- Matching
- Documentation

For Spooner:

- My Project
- Requests
- Onboarding
- Offboarding
- Resources

To keep the demo clean, the sidebar can dynamically change based on selected role.

---

## 5. Routing structure

Current Next.js routes:

```txt
/app
  /cto
    /overview
    /projects
    /employees
    /matching
    /documentation
  /spooner
    /page
    /[spoonerId]
    /[spoonerId]/my-project
    /[spoonerId]/requests
    /[spoonerId]/onboarding
    /[spoonerId]/offboarding
    /[spoonerId]/resources
```

The app shell derives the active role from the URL and keeps the selected Spooner in local storage/cookies for quick switching from the profile menu.

---

## DB API contract notes

The canonical API contract is [`../../docs/DB_API_DOCUMENTATION.md`](../../docs/DB_API_DOCUMENTATION.md). Frontend code should use these current shapes:

- Project responses include `icon_url`, `poster_url`, canonical `current_team_member_ids`, and display-only `current_team_members`.
- Employee responses include canonical `current_project_ids`, display `current_project_names`, and compatibility alias `current_project`.
- Use IDs for staffing logic, matching, and mutations. Use names only for display.
- `preferences` are still project-name strings.
- Move request responses include `employee_name`, `from_project_name`, and `to_project_name`, but accepting a move request does not automatically change assignments.
- Project documentation is stored in `project_documentation`, keyed one row per project, and can be read through `/project-documentation` or `/projects/{project_id}/documentation`.
- Transition instructions are stored in `move_request_transition_instructions` and exposed through `/employees/{employee_id}/transition-instructions` plus move-request-scoped aliases.

---

# CTO EXPERIENCE

## 6. CTO primary user goals

The CTO needs to:

1. Understand the state of projects and staffing.
2. Create a new project.
3. Connect project sources. The current build uses GitHub; Notion and Slack remain planned integrations.
4. Let the system infer required skills.
5. Review and adjust project requirements.
6. Get recommended employees.
7. Send move requests.
8. Track onboarding/offboarding status.
9. Manage the employee registry.

The CTO flow should feel like a control center, but not overloaded.

---

## 7. CTO screen 1 — Overview dashboard

### Purpose

Give an immediate snapshot of the portfolio, staffing, and documentation health.

### Layout

Top section:

- Page title: “Portfolio Overview”
- Subtitle: “Projects, staffing, and documentation health across the organization.”
- Primary CTA: “Create project”
- Secondary CTA: “View employees”

Metric cards:

1. Active projects
2. Employees available soon
3. Projects needing staffing
4. Documentation gaps

Main area:

- Left: Project health table
- Right: Recommended actions panel

### Components

- Card
- Button
- Badge
- Table
- Progress
- Alert

### Project health table columns

- Project
- Company/Product
- Phase
- Staffing health
- Documentation health
- Risk
- Action

Example rows:

| Project | Phase | Staffing | Docs | Risk | Action |
|---|---|---|---|---|---|
| Eventbrite | New acquisition | Needs team | Low | High | Match team |
| WeTransfer | Growth | Healthy | Medium | Medium | View |
| Remini | Growth | Understaffed | High | Medium | Match team |

### Recommended actions panel

Examples:

- “Eventbrite has low documentation coverage. Fetch GitHub docs.”
- “3 backend-capable employees become available next week.”
- “Remini needs one additional AI/backend profile.”

### UX principle

The overview should be useful in 5 seconds. Avoid deep analytics on the first screen.

---

## 8. CTO screen 2 — Project registry

### Purpose

Show all projects and allow the CTO to open, filter, or create projects.

### Layout

Top:

- Title: “Projects”
- Search input
- Filter chips: All, New acquisition, Active, Understaffed, Missing docs
- CTA: “Create project”

Main:

- Project cards or table

Use cards for demo visual polish. Use table if implementation speed matters.

### Project card content

- Product/company logo or initials
- Project name
- Phase badge
- Required skills preview
- Current team size
- Documentation health
- Staffing health
- Primary action: “Open”
- Secondary action: “Match team”

Example card:

```txt
Eventbrite
New acquisition
Required: Backend 3, Web 2, Infrastructure 2
Team: 0 assigned
Docs: Low
Staffing: Needs team
[Open] [Match team]
```

---

## 9. CTO screen 3 — Create project flow

### Purpose

Create a new project and use integrations to prefill required skills and project context.

This is one of the most important demo flows.

### Flow steps

Use a simple stepper or sequential form sections on one page.

#### Step 1 — Basic project info

Fields:

- Project name
- Product/company
- Project phase
- Project goal
- Expected duration
- Urgency

Example:

```txt
Project name: Eventbrite
Product/company: Eventbrite
Phase: New acquisition
Goal: Understand the codebase, stabilize billing, and prepare integration roadmap
Duration: 6 weeks
Urgency: High
```

#### Step 2 — Connect sources

Fields/actions:

- GitHub repository URL or selector
- Notion page/workspace selector
- Slack channel selector

For demo:

- Use prefilled mock selectors
- Show integration status badges

Example:

```txt
GitHub: github.com/eventbrite/core-platform  Connected
Notion: Eventbrite Acquisition Notes  Connected
Slack: #eventbrite-integration  Connected
```

Primary button:

```txt
Analyze project
```

#### Step 3 — AI-generated project analysis

After analysis, show:

- Detected stack
- Detected project type
- Inferred required skills
- Inferred documentation health
- Key risks
- Suggested team size

Example:

```txt
Detected stack:
React, Python, PostgreSQL, Kubernetes, Stripe, GitHub Actions

Inferred required skills:
Web: 2
Backend: 3
Infrastructure: 2
AI: 0
Android: 0
iOS: 0

Suggested team size: 4
Documentation health: Low
Key risk: Billing ownership unclear
```

#### Step 4 — CTO review and adjust

The CTO can adjust skill levels before matching.

Use simple skill level selectors:

- Android: 0–3
- iOS: 0–3
- Web: 0–3
- Backend: 0–3
- Infrastructure: 0–3
- AI: 0–3

Components:

- Select or segmented controls
- Badge explanations
- Card summary

Primary button:

```txt
Find matching employees
```

### UX principle

The AI should assist, not decide. The CTO always reviews before matching.

---

## 10. CTO screen 4 — Matching results

### Purpose

Recommend the best internal employees for the new project.

### Layout

Top:

- Project summary card
- Required skills summary
- Team size recommendation

Main:

- Recommended team cards
- Alternative candidates panel
- Risk/tradeoff summary

### Recommended employee card

Content:

- Avatar
- Name
- Role
- Current projects
- Availability
- Fit score
- Matching skill levels
- Why recommended
- Movement risk
- CTA: “Send request”

Example:

```txt
Sofia Romano
Backend Engineer · Current: WeTransfer
Fit: 91%
Availability: Available in 1 week
Skills: Backend 3, Infrastructure 2, Web 1

Why Sofia:
- Strong backend/platform match
- Recent billing reliability work
- Low risk to current project

[Send request]
```

### Recommended squad summary

Show the selected squad as a compact group:

```txt
Recommended squad
Backend lead: Sofia
Web/product: Luca
Infrastructure: Nina
Generalist/new joiner: Daniel
```

Actions:

- Send requests to all
- Adjust team
- Save draft

### UX principle

Do not show too many candidates. Show 3–5 strong recommendations and a small list of alternatives.

---

## 11. CTO screen 5 — Employee registry

### Purpose

Allow the CTO to view and manage employees.

### Layout

Top:

- Title: “Employees”
- Search input
- Filter chips: All, Internal, Acquired company, Available soon, Onboarding, Transitioning, Inactive
- CTA: “Create employee profile”

Main:

- Employee table

Columns:

- Name
- Source
- Status
- Current projects/products
- Skills
- Availability
- Action

### Employee source types

- Internal
- Acquired-company employee

### Status values

Internal employees:

- Active
- Onboarding
- Transitioning
- Unavailable
- Leaving
- Inactive

Acquired-company employees:

- Mapped
- Knowledge-holder
- Integration contact
- Leaving
- Inactive

### Employee detail page

Sections:

1. Profile summary
2. Skill levels
3. Current allocation
4. Project history
5. GitHub/Notion/Slack signals
6. Current status
7. Admin actions

Admin actions:

- Edit profile
- Change status
- Start offboarding
- Mark unavailable
- Create move request

Keep destructive actions soft and operational. Use “Start offboarding” or “Mark inactive,” not “Fire.”

---

## 12. CTO screen 6 — Documentation overview

### Purpose

Give the CTO a working project documentation studio: select a project, fetch GitHub-backed docs, review Markdown, edit/save changes, and chat with the generated documentation.

### Layout

Top:

- Title: “Documentation”
- Subtitle: “Project memory, onboarding docs, and handoff coverage.”

Main:

- Project list with generated-doc status
- Selected project documentation preview
- Markdown editor for manual corrections
- Chat panel with ask and edit-draft modes

Columns:

- Project
- GitHub sources
- Documentation status
- Last generated timestamp
- Action

Actions:

- Fetch new changes from GitHub
- Edit docs
- Save edited Markdown
- Ask questions about the docs
- Ask the assistant to draft an updated Markdown version

This screen is now a primary demo surface because its generated Markdown feeds the employee My Project view and transition instruction generation.

---

# EMPLOYEE EXPERIENCE

## 13. Employee primary user goals

The employee needs to:

1. See their current projects.
2. Understand their current responsibilities.
3. Receive project move requests.
4. Accept or reject reassignment.
5. See onboarding instructions for a new project.
6. See offboarding instructions for the previous project.
7. Access all resources needed to ramp up.
8. Generate handoff documentation when leaving a project.

The employee view should feel calm and helpful, not like surveillance.

---

## 14. Employee screen 1 — Home / My project

### Purpose

Give the employee a simple overview of their assigned projects, relevant project context, generated documentation, and next actions.

### Layout

Top:

- Page title: “My Project”
- Assigned project count, docs-ready count, and current role
- Pending request banner if applicable

Main cards:

1. Assigned project selector
2. Project information and staffing coverage
3. Repository links and current team
4. Required skill fit for the selected employee
5. Generated documentation preview
6. Project-specific documentation chat

### Current projects card

Content:

- Project name
- Phase
- Team members
- Staffing coverage
- Planned headcount vs. current team
- Repository links
- Required skills compared with the employee's skill levels

Example:

```txt
Current project
WeTransfer
Phase: Growth
Team: 5 people
Staffing: Covered
Docs: Ready
```

### Pending request banner

If there is a move request:

```txt
New project request
You have been requested to join Eventbrite for 6 weeks.
[Review request]
```

---

## 15. Employee screen 2 — Move request detail

### Purpose

Let an employee understand and respond to a project move request.

### Layout

Top:

- Project name
- Duration
- Requested role
- Requesting person

Main sections:

1. Why this request
2. What changes
3. New project context
4. Transition plan
5. Actions

### Example content

```txt
You have been requested to join Eventbrite.

Why you:
- Backend 3 and Infrastructure 2 match the project requirements.
- You recently worked on billing reliability.
- Your current project has low dependency risk if you transition next week.

Expected role:
Backend/platform engineer

Expected duration:
6 weeks
```

Actions:

- Accept request
- Reject request
- Ask for clarification

For demo, accept/reject can update local state only.

---

## 16. Employee screen 3 — Onboarding instructions

### Purpose

Give the employee generated Markdown instructions for joining the target project after a move request enters transition.

### Layout

Top:

- Project name
- Onboarding progress
- Estimated ramp-up time

Main:

- Generated Markdown instructions
- Source/target project summary
- Instruction status badge
- Progress indicator
- "Mark as solved" action

### Instruction content

#### Day 1 — Understand context

- Read project overview
- Read architecture summary
- Join Slack channel
- Review product goals

#### Day 2 — Understand codebase

- Clone repository
- Run local setup
- Review main services
- Read recent PRs

#### Day 3 — First contribution

- Pick first issue
- Pair with onboarding buddy
- Submit first small PR

### Components

- Progress
- Card
- Button
- Markdown preview

---

## 17. Employee screen 4 — Offboarding instructions

### Purpose

Help the employee leave a current project cleanly with generated Markdown handoff instructions.

### Layout

Top:

- Current project
- Transition deadline
- Offboarding progress

Main:

- Generated Markdown handoff instructions
- Source/target project summary
- Instruction status badge
- Progress indicator
- "Mark as solved" action

### Offboarding instruction examples

- Summarize recent work
- Link open PRs
- Link unresolved issues
- Document known risks
- Update runbook if needed
- Confirm handoff owner
- Generate handoff note

### Generated handoff note preview

Show a Markdown preview:

```md
# Handoff Summary — WeTransfer

## Recent work
...

## Open items
...

## Known risks
...

## Recommended next steps
...
```

Actions:

- Review generated instructions
- Mark as solved

Completing both onboarding and offboarding instruction rows can complete the parent move request through the DB API.

---

## 18. Employee screen 5 — Project resources

### Purpose

Centralize everything needed to understand and work on the project.

### Layout

Resource categories:

1. GitHub
2. Notion
3. Slack
4. Docs
5. People
6. Generated AI context

### Resource card examples

```txt
GitHub
core-platform
billing-service
frontend-web
```

```txt
Notion
Product overview
Acquisition notes
Roadmap
Architecture decisions
```

```txt
Slack
#eventbrite-integration
#eventbrite-support
#billing-platform
```

```txt
Generated docs
Project capsule
Architecture summary
Runbook
CLAUDE.md
AGENTS.md
```

Potential later automations:

- Request Slack access
- Request GitHub access
- Open onboarding checklist
- Notify project lead

---

# SHARED FLOWS

## 19. Project creation and matching flow

This is the main CTO demo flow.

### Flow

1. CTO clicks “Create project.”
2. CTO enters basic project details.
3. CTO connects GitHub sources.
4. Platform analyzes the sources.
5. Platform pre-fills required skill categories and levels.
6. CTO adjusts requirements.
7. Platform recommends employees.
8. CTO sends move requests.
9. Employee receives request.
10. Employee accepts.
11. Platform generates onboarding and offboarding instructions.
12. Platform shows project resources and generated documentation.

This should be the central demo path.

---

## 20. Employee transition flow

### Flow

1. Employee receives project move request.
2. Employee opens request details.
3. Employee sees why they were selected.
4. Employee reviews project context.
5. Employee accepts and the CTO approval path starts the transition.
6. Backend generates offboarding instructions for the source project from stored project docs and GitHub context.
7. Backend generates onboarding instructions for the target project from stored project docs and team context.
8. Employee reviews each instruction page and marks it solved.
9. Once both instruction rows are solved, the move request can be completed.

---

## 21. Documentation generation flow

### Flow

1. User opens project detail.
2. Platform shows documentation health.
3. User clicks “Fetch new changes from GitHub.”
4. Platform streams GitHub repository context into the documentation generator.
5. Platform generates Markdown docs:
   - Project overview
   - Architecture summary
   - Runbook
   - Onboarding guide
   - CLAUDE.md
   - AGENTS.md
6. User previews docs as they stream in.
7. User edits the Markdown manually or asks the chat assistant to draft changes.
8. User saves the project documentation row for employee and transition flows.

The current implementation is GitHub-first and LLM-backed. Notion/Slack export remains future scope.

---

# COMPONENT PLAN

## 22. Main reusable components

### AppShell

- Sidebar
- Header
- Role switcher
- Main content wrapper

### StatCard

Used on CTO overview.

Props:

- title
- value
- helperText
- trend/status

### ProjectCard

Used in project registry and overview.

Props:

- project name
- product/company
- phase
- staffing health
- docs health
- required skills
- action buttons

### EmployeeCard

Used in matching results.

Props:

- avatar
- name
- role
- current projects
- fit score
- skills
- availability
- reasoning

### SkillLevelMatrix

Used in project creation and employee profiles.

Rows:

- Android
- iOS
- Web
- Backend
- Infrastructure
- AI

Columns/selector:

- 0
- 1
- 2
- 3

### IntegrationConnector

Used in project creation.

Props:

- provider: GitHub / Notion / Slack
- status: connected / missing / mocked
- selected source
- action

### MoveRequestCard

Used in employee view.

Props:

- project
- requested role
- duration
- reason
- actions

### TransitionInstructionScreen

Used for onboarding/offboarding instruction pages.

Props:

- employee id
- instruction type
- status
- markdown content
- progress

### ProjectDocumentationPanel

Used for generated docs in CTO and Spooner workspaces.

Props:

- markdown content
- documentation status
- starter prompts
- ask/edit chat mode

---

## 23. Minimal demo data

### Employees

Seed 8–10 employees.

Each should have:

- name
- role
- source
- status
- current projects
- availability
- skill levels
- interests
- previous projects

Example:

```json
{
  "name": "Sofia Romano",
  "role": "Backend Engineer",
  "source": "internal",
  "status": "active",
  "current_project_ids": [3],
  "current_project_names": ["WeTransfer"],
  "current_project": "WeTransfer",
  "availability": "Available in 1 week",
  "skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  }
}
```

### Projects

Seed 5–6 projects.

Example:

- Eventbrite
- WeTransfer
- Remini
- Evernote
- Komoot
- StreamYard

---

## 24. Information density rules

To keep the UI clean:

- Show summaries first, details on click.
- Use cards for key decisions.
- Use tables only for registry screens.
- Avoid dense graphs unless needed.
- Use badges instead of long text where possible.
- Keep every page focused on one main action.
- Avoid more than 2 primary CTAs per screen.
- Use side panels/dialogs for editing rather than new complex pages.

---

## 25. Demo-critical screens

If time is limited, build only these screens:

1. CTO Overview
2. Create Project
3. AI Project Analysis / Skill Requirements Review
4. Matching Results
5. Employee Registry
6. Employee Move Request
7. CTO Documentation Workspace
8. Spooner Picker and My Project
9. Employee Onboarding/Offboarding Instructions

This is enough to tell the full story.

---

## 26. Recommended demo sequence

1. Start in CTO Overview.
2. Show Eventbrite needs a team.
3. Click “Create project” or open existing Eventbrite project.
4. Connect GitHub sources.
5. Show AI-inferred required skills.
6. CTO adjusts skill levels.
7. Show recommended team.
8. CTO sends request to one employee.
9. Switch to employee view.
10. Employee sees request.
11. Employee accepts.
12. Show generated onboarding/offboarding instructions.
13. Open My Project resources and docs.
14. Chat with the generated documentation pack.

End message:

The platform reduces the time from “new project needs a team” to “the right people are onboarded with the right context.”

---

## 27. UX priorities

Highest priority:

- The product must be understandable in one demo.
- The CTO flow must feel powerful but simple.
- The employee flow must feel helpful, not controlling.
- Integrations must feel deeply embedded in the workflow.
- Matching recommendations must be explainable.
- Documentation generation must feel practical and immediately useful.

Lower priority:

- Advanced analytics
- Full settings
- Complex permissions
- Real OAuth
- Real-time notifications
- Complex charts

---

## 28. Minimal Framer Motion animation plan

Animations should be used sparingly to make state changes feel clear and premium. The product is an internal tool, so the motion language should be calm, fast, and practical.

### Motion principles

- Keep animations short: usually `150–250ms`.
- Use simple opacity and small translate changes.
- Avoid playful/bouncy animations.
- Avoid complex scroll animations.
- Do not animate every small UI element.
- Use motion to explain transitions, not to decorate.
- Respect reduced-motion preferences.

### Recommended default transition

```ts
const defaultTransition = {
  duration: 0.2,
  ease: "easeOut",
};
```

### Page transitions

Use a subtle fade + vertical slide when switching between major views.

```tsx
<motion.main
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={defaultTransition}
>
  {children}
</motion.main>
```

Use for:

- CTO Overview
- Create Project
- Matching Results
- Employee Home
- Employee Request Detail
- Resources

### Card entrance animation

Use staggered card entrances on dashboard and matching screens.

```tsx
const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
```

Use for:

- Metric cards
- Project cards
- Recommended employee cards
- Resource cards

Keep the stagger very small, around `40–60ms`, so the UI still feels instant.

### Step transitions in create project flow

When moving from project details → integrations → analysis → skill review, animate the active step with a short fade/slide.

Use for:

- Step content change
- AI analysis result reveal
- Skill matrix reveal after analysis

Important: the stepper itself should remain stable. Only the content area should animate.

### AI analysis loading state

For the “Analyze project” action, use a clean loading state:

- Button enters loading state.
- Integration cards show scanning status.
- Analysis result fades in once ready.
- Optional skeletons inside analysis card.

Avoid fake long loading. For demo, the analysis can resolve quickly after a short scripted delay.

### Matching results reveal

After the CTO clicks “Find matching employees,” show recommended employee cards with a subtle stagger.

Use motion to make the matching feel generated, but keep it professional:

- First show project summary.
- Then reveal recommended squad cards.
- Then reveal risk/tradeoff summary.

### Move request interaction

When the CTO sends a move request:

- Button changes from “Send request” to “Request sent.”
- Card can show a small success badge.
- No large celebration animation.

When the employee accepts:

- Request card changes state to “Accepted.”
- Onboarding/offboarding sections fade in below.
- Progress checklist appears with a subtle entrance.

### Documentation generation reveal

When generating documentation:

- Show skeleton tabs or a short “Generating project capsule...” state.
- Fade in the DocumentationPreview component.
- Tabs should switch instantly or with very subtle opacity transitions.

Use for:

- Project capsule
- Architecture summary
- Runbook
- CLAUDE.md
- AGENTS.md
- Handoff summary

### Sidebar and navigation

Keep sidebar motion minimal:

- Active item indicator can animate position.
- Role switch can crossfade the navigation items.
- Avoid collapsing/expanding sidebar animations for the demo.

### Dialogs and sheets

Use shadcn defaults where possible. If adding motion manually:

- Dialog: opacity + scale from `0.98` to `1`.
- Sheet: slide from right using default shadcn/Radix behavior.

Use for:

- Edit employee profile
- Change employee status
- Create move request
- View reasoning details

### Micro-interactions

Allowed:

- Button hover states from shadcn/Tailwind.
- Card hover border/background change.
- Badge state changes.
- Progress bar updates.
- Checkbox completion transitions.

Avoid:

- Hover scaling on every card.
- Animated gradients.
- Floating elements.
- Confetti.
- Heavy parallax.
- Complex timeline animations.

### Reduced motion

Wrap motion utilities with a reduced-motion check if time allows.

```tsx
import { useReducedMotion } from "framer-motion";

const shouldReduceMotion = useReducedMotion();
```

If reduced motion is enabled, use opacity-only transitions or no animation.

### Components that should use motion

- `AnimatedPage`
- `AnimatedCardList`
- `StepTransition`
- `AnalysisResultReveal`
- `MatchingResultsReveal`
- `RequestStateTransition`
- `DocumentationReveal`

### Components that should not use motion

- Tables
- Forms while typing
- Skill level selectors
- Dropdown menus beyond shadcn defaults
- Dense employee registry rows
- Static text/content sections

### Final animation rule

Every animation must support one of these purposes:

1. Show that something changed.
2. Guide attention to a newly generated result.
3. Make a multi-step flow feel continuous.
4. Give the demo a polished feel without adding complexity.

If an animation does not do one of these things, skip it.

---

## 29. Final UI principle

Every important screen should answer one question:

- CTO Overview: What needs attention?
- Create Project: What are we staffing?
- Project Analysis: What skills does this project need?
- Matching: Who should join and why?
- Employee Registry: Who exists and what is their status?
- Move Request: Why am I being moved?
- Onboarding: What should I do next?
- Offboarding: What knowledge must I leave behind?
- Resources: Where is everything I need?

If a screen does not answer one of these questions, it should not be part of the MVP demo.

