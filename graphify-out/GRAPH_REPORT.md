# Graph Report - .  (2026-04-14)

## Corpus Check
- 120 files · ~83,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 268 nodes · 275 edges · 60 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin Registrations & Auth|Admin Registrations & Auth]]
- [[_COMMUNITY_UI Components & Tabs|UI Components & Tabs]]
- [[_COMMUNITY_Event Registration API|Event Registration API]]
- [[_COMMUNITY_Calendar & Rankings|Calendar & Rankings]]
- [[_COMMUNITY_Recreational Booking Engine|Recreational Booking Engine]]
- [[_COMMUNITY_Cross-module Bridges|Cross-module Bridges]]
- [[_COMMUNITY_Email Service & Templates|Email Service & Templates]]
- [[_COMMUNITY_Onsite & Range Weapons|Onsite & Range Weapons]]
- [[_COMMUNITY_Admin Panel Meta|Admin Panel Meta]]
- [[_COMMUNITY_Profile & Weapons CRUD|Profile & Weapons CRUD]]
- [[_COMMUNITY_Ammo Purchases & Inventory|Ammo Purchases & Inventory]]
- [[_COMMUNITY_Event Disciplines & Financials|Event Disciplines & Financials]]
- [[_COMMUNITY_Judge & AI Communities|Judge & AI Communities]]
- [[_COMMUNITY_AI Target Analysis|AI Target Analysis]]
- [[_COMMUNITY_Module System|Module System]]
- [[_COMMUNITY_Email System Meta|Email System Meta]]
- [[_COMMUNITY_Admin Page Helpers|Admin Page Helpers]]
- [[_COMMUNITY_Judge Notifications|Judge Notifications]]
- [[_COMMUNITY_Registration Pages|Registration Pages]]
- [[_COMMUNITY_Modules Provider|Modules Provider]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `Member Type` - 9 edges
2. `Supabase Client Library` - 9 edges
3. `Email Library` - 9 edges
4. `useBooking Hook` - 9 edges
5. `Email Service (Resend)` - 9 edges
6. `useEventRegistration Hook` - 8 edges
7. `Community: Admin Panel & Event Management` - 8 edges
8. `Calendar Page` - 7 edges
9. `DB Table: lane_reservations` - 7 edges
10. `useRecreationalBooking Hook` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Registrar Page` --semantically_similar_to--> `Admin Registrations Tab`  [INFERRED] [semantically similar]
  src/app/rejestracja/page.tsx → src/app/admin/components/RegistrationsTab.tsx
- `Guest Lane Reservation API` --semantically_similar_to--> `Guest Registration API`  [INFERRED] [semantically similar]
  src/app/api/reservations/guest/route.ts → src/app/api/rejestracja/route.ts
- `Onsite Member Registration Flow` --semantically_similar_to--> `useEventRegistration Hook`  [INFERRED] [semantically similar]
  src/hooks/admin/useOnsiteRegistration.ts → src/hooks/eventCard/useEventRegistration.ts
- `Next.js Config` --references--> `Judge Panel Page`  [EXTRACTED]
  next.config.ts → src/app/sedzia/page.tsx
- `Results Client Component` --shares_data_with--> `Result Type`  [INFERRED]
  src/app/wyniki/ResultsClient.tsx → src/types/database.ts

## Hyperedges (group relationships)
- **Event Registration Flow** — database_event, database_event_discipline, database_event_discipline_slot, database_event_registration, database_registration_discipline [EXTRACTED 0.95]
- **Recreational Shooting Feature** — page_recreational, recreational_client, hook_recreational, admin_shooting_package, admin_range_weapon, admin_shooting_lane [INFERRED 0.85]
- **Admin Panel Tab Components** — RangesTab_component, JudgesTab_component, InstructorsTab_component, RegulationsTab_component, DisciplinesTab_component [INFERRED 0.90]
- **Lane Reservation Flow (Hold -> Confirm -> Pay)** — reservations_hold_api, reservations_confirm_api, reservations_pay_api, payments_callback_api, db_table_lane_reservations, db_table_payments [EXTRACTED 0.95]
- **Recreational Shooting Booking Flow** — recreational_book_api, recreational_onsite_api, InstructorPage_component, db_table_recreational_bookings, db_table_lane_reservations, db_table_inventory_items [EXTRACTED 0.90]
- **Event Registration Flow** — component_event_card, hooks_event_card, route_zapisy_api, route_zapisy_dyscypliny_api, table_event_registrations, table_registration_disciplines [EXTRACTED 0.90]
- **Authentication Flow** — page_logowanie, page_dolacz, page_resetuj_haslo, component_auth_provider, component_navigation [EXTRACTED 0.90]
- **Onsite Booking Dual Implementation (reservations + recreational)** — useOnsiteBooking_reservations_hook, useOnsiteBooking_recreational_hook, api_recreational_onsite [EXTRACTED 0.90]
- **Lane Reservation Booking Flow (drag-select, hold, confirm)** — useDragSelection_hook, useBooking_hook, useHoldReservation_hook, useReservationData_hook, hold_reservation_pattern [EXTRACTED 0.95]
- **Admin Event Lifecycle (events, disciplines, slots, judges, financials, inventory)** — useEventManagement_hook, useDisciplineManagement_hook, useSlotManagement_hook, useJudgeManagement_hook, useEventFinancials_hook, useInventoryManagement_hook [INFERRED 0.85]
- **Admin Event-Day Operations** — useAdminData_useAdminData, useOnsiteRegistration_useOnsiteRegistration, usePrinting_usePrinting, concept_metryczka, concept_startNumbers [INFERRED 0.85]
- **he_event_registration** — hyperedge_event_reg_flow, community_registration_payments, community_reservations_calendar [EXTRACTED 0.95]
- **he_admin_tabs** — hyperedge_admin_tabs, community_admin_panel, community_misc_tabs [EXTRACTED 1.00]
- **he_recreational** — hyperedge_recreational, community_booking_engine, community_reservations_calendar [INFERRED 0.85]
- **he_lane_reservation** — hyperedge_lane_reservation, community_booking_engine, community_przelewy24 [EXTRACTED 0.95]
- **he_email_system** — hyperedge_email_system, community_email_service, community_email_templates [EXTRACTED 0.95]
- **he_auth_flow** — hyperedge_auth_flow, graph_report_auth_provider [EXTRACTED 0.90]
- **he_judge_scoring** — hyperedge_judge_scoring, community_judge_scoring, community_ai_target [EXTRACTED 0.95]
- **he_onsite_dual** — hyperedge_onsite_dual, community_booking_engine [EXTRACTED 0.90]
- **he_admin_event_day** — hyperedge_admin_event_day, community_admin_panel, community_registration_payments [INFERRED 0.85]

## Communities

### Community 0 - "Admin Registrations & Auth"
Cohesion: 0.1
Nodes (31): Admin Registrations Tab, AuthProvider Component, Discipline Type, Event Type, EventDiscipline Type, EventDisciplineSlot Type, EventRegistration Type, Member Type (+23 more)

### Community 1 - "UI Components & Tabs"
Cohesion: 0.13
Nodes (24): Clue IT About Page, Feedback Form Component, Instructor Panel Page, Instructors Tab (Admin), Judges Tab (Admin Permissions), Ranges Tab (Admin), Reservations Client Page, Reservations Server Page (+16 more)

### Community 2 - "Event Registration API"
Cohesion: 0.11
Nodes (21): API: /api/payments/create, API: /api/rejestracja (Guest Registration), API: /api/zapisy (Member Registration), API: /api/zapisy/dyscypliny (Add Disciplines), Attendance Sheet (Lista Obecnosci), Member Data Confirmation (30-day cycle), Metryczka (Score Sheet) Printing, Onsite Guest Registration Flow (+13 more)

### Community 3 - "Calendar & Rankings"
Cohesion: 0.16
Nodes (18): CalendarGroups Component, EventCard Component, RankingsClient Component, EventCard Hooks, Email Library, Guest Registration API, Event Reminder Email API, Registration Confirmation Email API (+10 more)

### Community 4 - "Recreational Booking Engine"
Cohesion: 0.15
Nodes (18): API: /api/recreational/book, API: /api/reservations/confirm, API: /api/reservations/hold, API: /api/reservations/pay, Cart-based Multi-Package Booking Pattern, DB Table: instructor_availability, DB Table: lane_reservations, DB Table: recreational_bookings (+10 more)

### Community 5 - "Cross-module Bridges"
Cohesion: 0.18
Nodes (13): Bridge: Result Notification Email API (betweenness 0.044), Bridge: Results DB Table (betweenness 0.045), Community: Booking & Availability Engine, Community: Przelewy24 Payments, Community: Registration & Payments API, Community: Reservations & Calendar UI, Community: Reservation Slot Helpers, Knowledge Gap: Registration & Payments low cohesion (0.08) (+5 more)

### Community 6 - "Email Service & Templates"
Cohesion: 0.18
Nodes (11): P24 Stub Mode for Testing, Safety Rules in Emails, Email Service (Resend), Email: Event Reminder, Email: Guest Registration Confirmation, Email: Payment Confirmation, Email: Range Rules for Recreational Booking, Email: Registration Confirmation (+3 more)

### Community 7 - "Onsite & Range Weapons"
Cohesion: 0.31
Nodes (9): API: /api/recreational/onsite, DB Table: members, DB Table: range_weapons, DB Table: shooting_packages, useOnlineUsers Hook, useOnsiteBooking (Recreational) Hook, useOnsiteBooking (Reservations) Hook, useRangeWeapons Hook (+1 more)

### Community 8 - "Admin Panel Meta"
Cohesion: 0.22
Nodes (9): Community: Admin Panel & Event Management, Community: Misc Tab Components, Knowledge Gap: Admin Panel low cohesion (0.07), Event Type - God Node (8 edges), Member Type - God Node (13 edges), Supabase Client Library - God Node (10 edges), Hyperedge: Admin Event-Day Operations, Hyperedge: Admin Panel Tab System (+1 more)

### Community 9 - "Profile & Weapons CRUD"
Cohesion: 0.29
Nodes (0): 

### Community 10 - "Ammo Purchases & Inventory"
Cohesion: 0.4
Nodes (6): Ammo Purchase Create API Route, Ammo Payment API Route, Ammo Purchases DB Table, Inventory Items DB Table, Inventory Transactions DB Table, Payments DB Table

### Community 11 - "Event Disciplines & Financials"
Cohesion: 0.33
Nodes (6): DB Table: event_discipline_slots, DB Table: event_disciplines, DB Table: events, useEventFinancials Hook, useEventManagement Hook, useSlotManagement Hook

### Community 12 - "Judge & AI Communities"
Cohesion: 0.4
Nodes (6): Community: AI Target Analysis, Community: Ammo & Inventory API, Community: Events & Judge Notification, Community: Judge Scoring Page, Hyperedge: Judge Scoring Workflow, Surprising: Next.js Config references Judge Panel Page

### Community 13 - "AI Target Analysis"
Cohesion: 0.5
Nodes (5): API: /api/analyze-target (AI Vision), API: /api/results (Score Submission), AI Target Photo Analysis, useScoreForm Hook, useTargetPhoto Hook

### Community 14 - "Module System"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Email System Meta"
Cohesion: 0.5
Nodes (5): Community: Email Service Layer, Community: Email Templates & Config, Email Library - God Node (9 edges), Email Service (Resend) - God Node (9 edges), Hyperedge: Email Notification System

### Community 16 - "Admin Page Helpers"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Judge Notifications"
Cohesion: 0.67
Nodes (3): Resend Email Service, Judge Notification API Route, Event Judges DB Table

### Community 18 - "Registration Pages"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Modules Provider"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (3): Knowledge Gap: 91 Isolated Nodes, Corpus Statistics (116 files, ~77,966 words), Graph Summary (427 nodes, 425 edges, 118 communities)

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (2): Regulations Tab (Admin), DB Table: regulations

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (2): Disciplines Tab (Admin), Rankings Server Page

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (2): DB Table: login_history, Auth Login Logger API

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (2): AI Target Analysis API, Anthropic Claude Vision API Integration

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (2): GitHub Issues Integration, Feedback API Route

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (2): DB Table: results, useResultsPreview Hook

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (2): DB Table: disciplines, useDisciplineManagement Hook

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (2): AGENTS.md - Next.js Agent Rules, CLAUDE.md - Project Config

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (2): Community: API Routes Hub, POST() - God Node (23 edges)

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (2): AuthProvider Component - God Node (10 edges), Hyperedge: Authentication Flow

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (1): Database Schema Interface

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (1): Reservations Hooks Index (barrel export)

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (1): Recreational Hooks Index (barrel export)

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (1): Judge Types

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): Date Utilities

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): README - Next.js Project

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): Notion Client Collaboration Template

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (1): Notion Kanban Client Collaboration Workflow

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): File Document Icon SVG

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (1): Vercel Logo SVG

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (1): Next.js Logo SVG

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): Globe Icon SVG

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): Window/Browser Icon SVG

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): App Icon - Shooting Target Crosshair SVG

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (1): Surprising: Onsite Registration similar to useEventRegistration

## Knowledge Gaps
- **107 isolated node(s):** `Next.js Config`, `MemberWeapon Type`, `RegistrationDiscipline Type`, `Database Schema Interface`, `Admin Registrations Tab` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 22`** (2 nodes): `middleware()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `TimeSelect()`, `EventsTab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `Regulations Tab (Admin)`, `DB Table: regulations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `Disciplines Tab (Admin)`, `Rankings Server Page`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `DB Table: login_history`, `Auth Login Logger API`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `AI Target Analysis API`, `Anthropic Claude Vision API Integration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `GitHub Issues Integration`, `Feedback API Route`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `handlePasswordReset()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `useInventoryManagement.ts`, `useInventoryManagement()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `useJudgeManagement.ts`, `useJudgeManagement()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `DB Table: results`, `useResultsPreview Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `DB Table: disciplines`, `useDisciplineManagement Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `useAdminData.ts`, `useAdminData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `useJudgeAuth.ts`, `useJudgeAuth()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `AGENTS.md - Next.js Agent Rules`, `CLAUDE.md - Project Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `Community: API Routes Hub`, `POST() - God Node (23 edges)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `AuthProvider Component - God Node (10 edges)`, `Hyperedge: Authentication Flow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `admin.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `Database Schema Interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `InventoryTab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `Reservations Hooks Index (barrel export)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `Recreational Hooks Index (barrel export)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `Judge Types`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `Date Utilities`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `README - Next.js Project`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `Notion Client Collaboration Template`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `Notion Kanban Client Collaboration Workflow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `File Document Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `Vercel Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `Next.js Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Globe Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Window/Browser Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `App Icon - Shooting Target Crosshair SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `Surprising: Onsite Registration similar to useEventRegistration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Email Library` connect `Calendar & Rankings` to `UI Components & Tabs`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `Calendar Page` connect `Admin Registrations & Auth` to `Calendar & Rankings`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `Next.js Config`, `MemberWeapon Type`, `RegistrationDiscipline Type` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Registrations & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `UI Components & Tabs` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Event Registration API` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._