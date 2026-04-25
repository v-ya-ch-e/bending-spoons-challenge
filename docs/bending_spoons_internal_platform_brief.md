# Atlas: Internal Platform Concept — Talent, Project & Documentation OS

## What we are building

We are building an internal platform for Bending Spoons that helps leadership and employees manage dynamic project staffing, especially across newly acquired companies and products. The platform combines an employee skill/capability registry, a project registry, a project-to-employee matching engine, and a documentation engine connected to GitHub, Notion, and Slack.

The core idea is simple: when a new project or acquired product needs a team, the platform helps the CTO understand available talent, recommend the right people, manage reassignment requests, and generate the onboarding/offboarding documentation needed to make transitions fast and low-friction.

This is not meant to be a traditional HR tool. It is an internal operating system for allocating people, preserving project knowledge, and reducing ramp-up time.

---

## Core users

### 1. CTO / leadership

The CTO view is used to understand the current state of projects and teams, create new projects, review staffing recommendations, and assign or request employees for new projects.

Key capabilities:

- View all active projects and their staffing status.
- View and manage the full employee registry.
- Create employee profiles for new joiners or incoming employees from acquired companies.
- Change an employee’s internal status, such as active, onboarding, transitioning, unavailable, leaving, or inactive.
- Start an offboarding flow when someone leaves the company or a project.
- Create a new project or acquired-product initiative.
- Define required capabilities, urgency, expected duration, and project goals.
- See recommended employees for the project.
- Understand why each employee is recommended.
- Send project-move requests to selected employees.
- Monitor onboarding/offboarding progress.
- Identify documentation gaps across the organization.

### 2. Employees

The employee view helps each person understand their current assignment, see project move requests, accept or reject reassignment proposals, and receive structured onboarding/offboarding todos.

Key capabilities:

- See current project and role.
- See pending requests to move to another project.
- Accept or reject move requests.
- View generated onboarding todos for the new project.
- View generated offboarding todos for the current project.
- Access all relevant project resources: GitHub repos, Notion docs, Slack channels, ownership notes, architecture docs, runbooks, and project context.
- Eventually trigger automations such as requesting Slack channel access or adding the employee to project resources.

### 3. Platform / operations layer

The platform itself continuously connects people, projects, documentation, and integrations.

Key capabilities:

- Keep the employee registry up to date.
- Keep the project registry up to date.
- Use GitHub, Notion, and Slack signals to understand project context.
- Use integrations proactively inside core flows instead of only storing links.
- Automatically infer required project skills from connected repositories, docs, and team conversations.
- Let the CTO review and manually adjust AI-generated project requirements before matching starts.
- Generate missing documentation.
- Generate offboarding summaries from an employee’s recent work.
- Generate onboarding packs for incoming team members.

---

## Main product modules

## 1. Employee + skill registry

A dynamic profile for every employee, split into two related layers:

- **Internal employee registry** — existing Bending Spoons employees who can be dynamically assigned across products and projects.
- **External/acquired-company employee registry** — employees coming from newly acquired companies who need to be mapped and understood as part of the acquired product/company context. In the core scope, they remain attached to their originating company/product and are not dynamically reassigned across Bending Spoons projects like internal employees.

This distinction matters because acquired companies may bring their own teams, knowledge, ownership structures, and undocumented project context. The platform should help leadership understand both the existing internal talent pool and the incoming employee/project knowledge from acquisitions. Internal employees are the primary pool for dynamic project staffing. External/acquired-company employees are primarily represented as context holders, system owners, and knowledge sources for the acquired product. Decisions about optimizing, moving, or letting go of acquired-company employees during acquisition integration are a separate topic and should stay outside the core demo scope.

This should not be a static “skills matrix.” At Bending Spoons, engineers are flexible and can often work across many areas. Therefore, the registry should capture both explicit skills and practical signals.

Employee profile data:

- Name.
- Role.
- Current project.
- Skills and capabilities, using the core skill categories and level scale below.
- Preferences (top3 preferred projects)
- Interests.

Core skill categories:

- Android
- iOS
- Backend
- Web
- Infrastructure
- AI/ML

Skill levels:

- **0 — No experience / not currently relevant**
- **1 — Basic familiarity / can contribute with support**
- **2 — Strong working capability / can work independently**
- **3 — Expert / can lead, review, and onboard others**

Each employee profile should store skill levels per category, for example:

```json
{
  "android": 1,
  "ios": 0,
  "web": 2,
  "backend": 3,
  "infrastructure": 2,
  "ai": 1
}
```

---

## 2. Project registry

A central overview of all active projects, products, acquired companies, and internal initiatives.

Project data:

- Project name.
- Project description.
- Project phase: new acquisition, growth, maintenance.
- Current team members.
- Required people amount + skill levels per core skill category (Android, iOS, Web, Backend, Infrastructure, and AI/ML).
- GitHub repositories.

The project registry becomes the single source of truth for what exists, who works where, what needs help, and what knowledge is available.

---

## 3. Project-to-employee matching engine

The matching engine recommends the best employees for a project based on more than just skills.

Inputs:

- Project goals.
- Required capabilities.
- AI-inferred required skills from GitHub repositories, Notion docs, and Slack/project context.
- CTO-adjusted skill requirements.
- Urgency.
- Team size.
- Current team composition.
- Employee skill levels across Android, iOS, Web, Backend, Infrastructure, and AI.
- Employee availability.
- Employee interests.
- Previous project/domain experience.
- GitHub/Notion/Slack activity signals.
- Risk of moving someone away from their current project.

Outputs:

- Recommended team members.
- Fit score per person.
- Explanation for each recommendation.
- Risks and tradeoffs.
- Estimated ramp-up time.
- Suggested role on the new project.
- Required onboarding materials.

The matching should be explainable. The CTO should be able to understand why someone was recommended, what risk their reassignment creates, and what needs to happen before they can join the new project.

---

## 4. CTO overview and controls

The CTO dashboard is the control center.

Core screens:

- Portfolio/project overview.
- Full employee registry view.
- Employee profile management page.
- Create new employee/new joiner profile flow.
- Employee status management flow.
- Project detail page.
- Create new project flow.
- Recommended staffing view.
- Employee assignment request flow.
- Documentation health overview.
- Current team allocation map.

The CTO should be able to manage the employee registry at a lightweight operational level. This includes creating a new joiner profile, updating someone’s status, marking someone as unavailable, starting offboarding, or marking a person as inactive. For internal employees, these statuses can affect matching and project reassignment. For acquired-company employees, the status mainly describes their relationship to the acquired product and their usefulness as knowledge/context owners. For the demo, this should be represented as lifecycle/status management rather than a full HR/legal system.

Example flow:

1. CTO creates a new project.
2. CTO connects or selects the relevant GitHub repository, Notion workspace/pages, and Slack channels.
3. Platform analyzes the connected sources to infer the project type, technical stack, required skill categories, required skill levels, documentation health, and likely staffing needs.
4. CTO reviews and adjusts the generated project requirements.
5. Platform recommends a team based on the adjusted requirements.
6. CTO reviews explanations and tradeoffs.
7. CTO sends move requests to selected employees.
8. Employees accept/reject.
9. Platform generates offboarding and onboarding todos.
10. Platform provides all project resources and documentation.

---

## 5. Employee project view

The employee view should make transitions clear and useful, not bureaucratic.

Core screens:

- Current project overview.
- Pending project move request.
- Accept/reject request action.
- Onboarding todos for the new project.
- Offboarding todos for the current project.
- Project resources page.
- Generated documentation pack.

Example employee move request:

> You have been requested to join the Eventbrite Integration project for 6 weeks.
>
> Reason: Your recent work on subscription systems and backend reliability makes you a strong fit.
>
> Expected role: Backend/platform engineer.
>
> Ramp-up estimate: 4 days.
>
> Current project impact: Low.

Employee actions:

- Accept.
- Reject.
- Request clarification.
- View project context.

---

## 6. Documentation engine

The documentation engine keeps project knowledge alive and reduces the problem of missing or outdated documentation.

It has two main functions:

### A. Project documentation generation and maintenance

The system scans GitHub, Notion, and Slack to generate or update documentation for a project.

Generated materials can include:

- Project overview.
- Architecture summary.
- Repository map.
- Main services and ownership.
- Important links.
- Runbook.
- Onboarding guide.
- Known risks.
- Recent important decisions.
- AI-agent context files such as `CLAUDE.md`, `AGENTS.md`, or Codex-style project skills.

### B. Employee offboarding documentation

When someone leaves a project, the system helps them generate a structured summary of what they worked on.

Generated offboarding materials can include:

- Recent work summary.
- Open PRs/issues.
- Important decisions made.
- Unfinished tasks.
- Known risks.
- Key files/services touched.
- Handoff notes for the next person.
- Suggested updates to project documentation.

This solves the problem that project knowledge is often scattered across code, docs, and conversations.

---

## 7. Deep integrations

The platform should integrate deeply with the tools teams already use.

### GitHub

Used for:

- Repositories.
- PRs.
- Commits.
- Code ownership signals.
- Review activity.
- README/docs quality.
- Open issues.
- Recent work history.
- Automatic project analysis during project creation.
- Inferring required skills from repository languages, frameworks, services, dependencies, CI/CD files, infrastructure code, and AI-related files.
- Detecting whether the project likely needs Android, iOS, Web, Backend, Infrastructure, or AI expertise.
- Estimating required skill levels from project complexity and risk.
- Suggesting missing documentation and onboarding resources.

### Notion

Used for:

- Product specs.
- Project docs.
- Roadmaps.
- Meeting notes.
- Decision logs.
- Existing onboarding material.
- Understanding project goals and business context during project creation.
- Comparing existing documentation against what the codebase suggests should exist.
- Finding missing or outdated onboarding/project documentation.

### Slack

Used for:

- Project channels.
- Important discussions.
- Decisions that never made it into docs.
- Repeated questions or blockers.
- Team context.
- Identifying active project owners and recurring support needs.
- Detecting undocumented operational knowledge that should be added to the project capsule.

Possible later automations:

- Add employee to relevant Slack channels.
- Request GitHub access.
- Link Notion onboarding pages.
- Notify project leads when someone joins or leaves.
- Create onboarding/offboarding tasks automatically.

---

## Additional add-ons

These are useful but should be treated as secondary features for now.

### New joiner matching

New employees complete a lightweight profile and are matched to a suitable first project based on background, interests, company needs, and onboarding readiness.

This should stay simple and should not become the core product. A possible add-on flow:

1. New joiner signs in.
2. They import or prefill their profile from LinkedIn.
3. They confirm a few key skills, interests, and preferred project areas.
4. The platform recommends a first project, onboarding buddy, and first-week onboarding plan.

The LinkedIn import should be treated as a convenience layer, not as a required dependency for the main demo.

### Hiring recommendation

The platform identifies capability gaps across projects and suggests what type of hire would help most.

Example:

> Multiple active projects need backend/video infrastructure expertise, but current experts are already allocated. Recommended hiring profile: senior backend/platform engineer with media infrastructure experience.

### Team health and risk view

The platform could show bus-factor risks, overloaded teams, missing documentation, and knowledge concentration.

---

## MVP scope for demo

For the functional demo, we should focus on the core story and avoid overcomplicating the product.

### Must-have demo features

1. Employee registry with seeded profiles.
2. CTO employee registry management view.
3. Basic employee lifecycle/status management.
4. Project registry with seeded projects.
5. CTO dashboard.
6. Create-new-project flow.
7. GitHub-based project analysis that pre-fills required skills and skill levels.
8. CTO review/edit step for generated project requirements.
9. Project-to-employee matching recommendations.
10. Employee move request view.
11. Onboarding/offboarding todo generation.
12. Project resource page with GitHub, Notion, and Slack links.
13. Documentation generator preview.

### Nice-to-have demo features

1. GitHub integration with one real repo.
2. Mock Notion import.
3. Mock Slack context import.
4. AI-generated `CLAUDE.md` / `AGENTS.md` / project onboarding docs.
5. Internal vs. acquired-company employee distinction in the registry, where only internal employees are part of the core dynamic reassignment flow.
6. New joiner matching card.
7. Lightweight LinkedIn profile import mock for new joiners.
8. Hiring recommendation card.

### Avoid for demo

- Full HR system.
- Complex permissions.
- Full Slack OAuth.
- Full Notion OAuth.
- Payroll/headcount planning.
- Employee performance scoring.
- Overly complex AI agent orchestration.

---

## Demo narrative

The demo should follow one simple story:

1. A new project/acquired company needs a team.
2. CTO creates the project in the platform.
3. The system recommends the best team members.
4. CTO sends project move requests.
5. Employee sees the request and accepts.
6. The system generates offboarding todos from the old project.
7. The system generates onboarding todos and resources for the new project.
8. The documentation engine creates or updates the project documentation.
9. The new team member can ramp up faster with all context in one place.

---

## Short pitch

We are building an internal Talent, Project & Documentation OS for Bending Spoons.

The platform helps leadership dynamically assign employees to projects, especially newly acquired products, while helping employees transition smoothly between teams. It combines an employee capability registry, a project registry, an explainable matching engine, and a documentation engine connected to GitHub, Notion, and Slack.

The CTO can create a new project, receive team recommendations, and send move requests. Employees can accept or reject project moves, see onboarding/offboarding todos, and access all relevant project resources. The documentation engine keeps project knowledge up to date and helps employees generate handoff documentation when they leave a project.

The goal is to reduce ramp-up time, preserve project knowledge, and make dynamic team allocation faster, clearer, and less dependent on informal communication.