# Baladiyati — System Features Overview (Customer Sales Document)

Baladiyati is a **multi-municipality citizen services platform** for reporting issues, managing municipal workflows, and operating many municipalities from one central system. It includes a **mobile app (citizens)**, a **web dashboard (staff & citizens)**, a **public website**, and a **central platform console (super admin)**.

---

## Product at a Glance

| Component | Who uses it | Purpose |
|-----------|-------------|---------|
| **Mobile app** (iOS/Android via Expo) | Citizens | Submit complaints, track status, news, notifications |
| **Web dashboard** | Staff, admins, citizens | Full operations, configuration, reporting |
| **Public website** | Everyone | Municipality discovery, announcements, app download |
| **Platform console** | Super admin | Manage all municipalities, boundaries, branding, audit |

**Languages:** English, Arabic (RTL), French  
**Architecture:** Multi-tenant — each municipality has its own users, departments, categories, and data isolation

---

## 1. Citizen Features (Mobile + Web)

### Complaint submission

- Submit complaints with **title, description, category, photos**
- **GPS location** capture for incident location
- **Location-based routing** — complaint is assigned to the municipality whose **service boundary** contains the incident (not just the citizen’s registered municipality)
- Handles **out of coverage**, **ambiguous overlap** (citizen picks municipality), and **location required** cases
- Photo attachments at submission
- View **My Reports** across municipalities (citizens see all their own complaints)

### Account & profile

- Registration with municipality selection
- Login, password reset, email verification
- Profile management
- **Two-factor authentication** (authenticator app and/or email OTP)
- Language preference (EN / AR / FR)

### Citizen verification (KYC)

- Submit identity verification documents
- Track verification status (pending / approved / rejected)
- Policy can require verification before submitting complaints

### Engagement

- **News** — municipal announcements and updates
- **Notifications** — in-app + push (FCM) for complaint status, news, KYC, etc.
- **Public announcements** — platform-wide and municipality-specific

---

## 2. Complaint Management (Municipal Staff)

### Full complaint lifecycle

Statuses from submission to closure:

`Submitted` → `Under Review` → `Assigned` → `In Progress` → `Pending Approval` → `Completed` / `Rejected` → `Closed`

### Operations

- **Role-based views:** own, assigned, department, or all complaints
- **Assign** complaints to field workers
- **Change status** with audit trail (status history log)
- **Set priority** (Low, Medium, High, Urgent)
- **Reject** with structured reasons (duplicate, out of jurisdiction, insufficient info, etc.)
- **Verify / approve** workflow for supervisors and heads of department
- **Attachments** — submission photos, proof of work, inspection photos
- **Real-time updates** — live complaint updates via WebSocket (no constant refresh)
- **Staff routing indicators** — shows how incident municipality was resolved (boundary match, buffer, legacy, etc.)

### Cross-department collaboration

- **Transfers** — move complaint ownership to another department (supervisor/HOD workflow)
- **Help requests** — request assistance from another department without losing ownership
- Accept/reject transfers, assign helpers, track history

---

## 3. Internal Tasks (Staff-Only)

Separate from citizen complaints — internal municipal work items:

- Create, assign, and track tasks
- Department-scoped and assignee-scoped views
- Status workflow and permissions
- Real-time notifications for task events

---

## 4. Organization & Administration (Per Municipality)

### Structure

- **Departments** — organizational units with heads
- **Org chart** — visual hierarchy of users and departments
- **Users** — create, update, deactivate staff accounts
- **Roles & permissions** — granular RBAC (50+ permissions)
- Default roles (Admin, HOD, Supervisor, Worker, Citizen, etc.) seeded per municipality

### Configuration

- **Categories** — complaint types per municipality (with EN/AR/FR names)
- **Municipality settings** — branding (logo, colors, banner), contact info
- **News management** — draft, publish, multilingual content
- **Audit log** — municipality-scoped security and admin events

### Reporting

- Dashboard with KPIs and complaint metrics
- Department-level and municipality-wide reporting permissions

---

## 5. Geographic Boundary & Routing (Super Admin)

Critical for accurate **“where did this happen?”** routing:

### Global Boundary Assignment Map (`/platform/boundaries`)

- Upload Lebanon **Admin3 / cadastral GeoJSON** once (~1,600 areas)
- Click/select areas on a map and **assign to municipalities**
- Search/filter by name (EN/AR), district, governorate, pcode
- Merge multiple cadastral areas into one municipality boundary
- Color-coded map: unassigned, assigned, conflicts, selection
- Overlap warnings before save

### Per-Municipality Boundary Editor

- Draw/edit boundaries on map (Leaflet)
- Satellite + street basemap
- Import from Admin3 GeoJSON (per municipality)
- Manual GeoJSON paste (advanced)
- Buffer zone (0–1000 m) outside polygon
- Validate, save, deactivate boundaries
- Neighbor boundary preview to avoid gaps/overlaps

### Routing behavior (automatic)

- GPS incident location → municipality via **active boundaries only**
- Exact match → buffer zone → out of coverage
- Overlapping boundaries → citizen selects municipality
- No “nearest municipality” guessing

---

## 6. Platform Super Admin (Multi-Municipality Operator)

### Municipality management

- Create municipalities (with default departments, roles, first admin)
- Activate/deactivate municipalities
- Transfer municipality administrator
- View all municipalities and status

### Users & security

- View **all platform users** across municipalities
- **Impersonate** users for support (audited, short-lived tokens)
- Reset 2FA for users
- Platform-wide audit log (exportable)

### Operations & branding

- **Platform overview** — stats (municipalities, users, complaints, resolution rate, overdue)
- **Maintenance mode** — block logins with banner (admins can still access)
- **Platform branding** — logos, colors, public site appearance
- **Platform announcements** — cross-municipality public notices
- **Test email** configuration

### Boundaries

- Global assignment map (above)
- Per-municipality boundary editors

---

## 7. Public Website

- Marketing/home page with platform branding
- **Municipality directory** — browse municipalities
- Municipality profile pages (contact, branding)
- **Public announcements**
- FAQ, contact page
- **Download app** page
- Multilingual (EN / AR / FR)

---

## 8. Security, Compliance & Technical Capabilities

| Area | Features |
|------|----------|
| **Authentication** | JWT access + refresh tokens, email verification, password reset |
| **2FA** | TOTP (authenticator) + email OTP, enrollment enforcement for web staff |
| **Authorization** | Role-based permissions, super-admin guard, web-only routes |
| **Audit** | Tenant audit + platform audit, impersonation logging |
| **Rate limiting** | Throttling on auth endpoints |
| **File storage** | Secure uploads (complaints, KYC, avatars, branding) |
| **Email** | Transactional email (verification, 2FA, notifications) |
| **Push notifications** | Firebase Cloud Messaging (mobile) |
| **Real-time** | Socket.IO for live complaint/task updates |
| **API** | REST API with Swagger/OpenAPI docs |
| **Monitoring** | Sentry integration (optional) |
| **Database** | PostgreSQL with Prisma ORM, migrations, seed data |

---

## 9. Permission Model (Granular Access Control)

Permissions are grouped by module, for example:

- **Complaints** — create, view (own/assigned/department/all), assign, status, verify, approve, reject, priority, attachments
- **Categories, Departments, Users, Roles** — full CRUD where allowed
- **News** — create, publish, delete
- **KYC** — submit, review
- **Tasks** — create, assign, status, delete
- **Transfers & Help requests** — request, respond, view
- **Audit** — view municipality audit trail
- **Platform** — manage municipalities, users, boundaries, impersonate, maintenance, announcements

Municipality admins get full municipal permissions; **platform permissions are super-admin only**.

---

## 10. What Makes This Sellable (Value Propositions)

1. **True multi-municipality SaaS** — one deployment, many municipalities, isolated data
2. **GIS-aware complaint routing** — incident location drives the right municipality (Lebanon Admin3-ready)
3. **Complete workflow** — not just a form; assignment, approval, transfers, help requests, audit
4. **Citizen mobile app + staff web** — end-to-end digital municipal services
5. **Trilingual** — English, Arabic (RTL), French for Lebanon and similar markets
6. **Enterprise controls** — 2FA, audit, impersonation, maintenance mode, RBAC
7. **Real-time operations** — staff see updates instantly
8. **Configurable per municipality** — branding, categories, departments, boundaries

---

## Optional: Package Tiers (How You Might Position It)

| Tier | Includes |
|------|----------|
| **Citizen** | Mobile app, submit/track complaints, news, notifications |
| **Municipal Standard** | + Web dashboard, departments, roles, complaint workflow, categories, news |
| **Municipal Pro** | + Tasks, transfers, help requests, org chart, audit, KYC review |
| **Platform Operator** | + Multi-municipality console, boundary tools, impersonation, platform branding |

---

## Web Dashboard Routes (Reference)

| Area | Route |
|------|--------|
| Dashboard | `/dashboard` |
| Complaints | `/complaints`, `/complaints/new`, `/complaints/[id]` |
| Tasks | `/tasks`, `/tasks/new`, `/tasks/[id]` |
| Transfers | `/transfers` |
| Help requests | `/help-requests`, `/help-requests/[id]` |
| Users | `/users`, `/users/new`, `/users/[id]` |
| Departments | `/departments` |
| Roles | `/roles`, `/roles/new`, `/roles/[id]` |
| Categories | `/categories` |
| News | `/news`, `/news/new`, `/news/[id]` |
| KYC review | `/kyc`, `/kyc/[id]` |
| Org chart | `/org-chart` |
| Audit | `/audit` |
| Municipality settings | `/municipality-settings` |
| Profile | `/profile` |
| Notifications | `/notifications` |

### Platform (super admin)

| Area | Route |
|------|--------|
| Platform overview | `/platform` |
| Municipalities | `/platform/municipalities` |
| Boundary assignment map | `/platform/boundaries` |
| Per-municipality boundary | `/platform/municipalities/[id]/boundary` |
| All users | `/platform/users` |
| Platform audit | `/platform/audit` |
| Maintenance | `/platform/maintenance` |
| Branding | `/platform/branding` |
| Announcements | `/platform/announcements` |

### Public website

| Area | Route |
|------|--------|
| Home | `/` |
| Municipalities | `/municipalities`, `/municipalities/[slug]` |
| Announcements | `/announcements`, `/announcements/[id]` |
| FAQ | `/faq` |
| Contact | `/contact` |
| Download app | `/download-app` |

---

## Mobile App Screens (Reference)

| Screen | Purpose |
|--------|---------|
| Welcome / Login / Register | Authentication |
| Home | Citizen dashboard |
| Submit | New complaint with GPS & photos |
| My complaints | Track submitted reports |
| News | Municipal news |
| Inbox / Notifications | Alerts |
| Tasks | Staff task list (if permitted) |
| Profile | Account settings |
| KYC | Identity verification |
| 2FA enrollment | Security setup |
| Complaint detail | Single complaint view |
| Help request detail | Help workflow |

---

*Document generated from the Baladiyati codebase. Update this file when major features are added.*
