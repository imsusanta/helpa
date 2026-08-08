# Helpa UX & Design System Audit

**Document Version:** 1.0.0  
**Design Standard:** Modern, Trustworthy Healthcare SaaS  
**Accessibility Target:** WCAG 2.2 AA Compliance  

---

## 1. Landing Page Evaluation & Brand Identity

### Findings:
1. **Brand Confusion**: The current landing page still contains generic developer-focused copy ("CRM Template for WhatsApp", "Deploy to Hostinger", "Fork it, brand it") rather than communicating direct value to clinic owners and hospital administrators ("Never miss a patient appointment again with 24/7 AI WhatsApp reception").
2. **Outcome-First Positioning**: Clinic owners care about reducing receptionist burnout, eliminating double-booked OPD slots, sending automated lab reports, and increasing patient show-up rates.
3. **Transparent Trust Signals**: Remove any generic or unverified claims. Clearly explain official Meta WhatsApp Cloud API connectivity, end-to-end data encryption, and instant patient ticket generation.

---

## 2. Core Clinical Journeys & UI State Polish

### A. Clinic Onboarding Journey
* **Step 1 — Clinic Profile**: Clinic Name, Timezone (`Asia/Kolkata`), Currency (`INR / ₹`), Business Address.
* **Step 2 — Doctors & Departments**: Add doctors with consultation fees and weekly OPD schedules.
* **Step 3 — WhatsApp Cloud API Setup**: Step-by-step guidance for Meta Phone Number ID and Access Token with clear error diagnostics.
* **Step 4 — AI Receptionist Configuration**: Knowledge base Q&A, OPD consultation hours, emergency escalation phone number.
* **Step 5 — Verified Test Message**: Send live verification WhatsApp message to confirm setup.

### B. WhatsApp Live Inbox & Receptionist Copilot
* **Loading & Offline States**: Smooth skeleton loaders, connection status badge (`Connected`, `Reconnecting`, `Offline`).
* **Patient Context Sidebar**: Instant view of Patient ID, Blood Group, Appointment History, and Pathology Reports.
* **Quick Appointment Booking**: 1-click action to book and confirm an appointment directly from chat.
* **Accessibility**: Full keyboard navigation (`Tab`, `Enter`, `Esc`), visible focus rings (`ring-2 ring-primary`), high-contrast text ratios exceeding 4.5:1.

---

## 3. Design System Tokens & Color Palette

| Token | Dark Mode Value | Light Mode Value | Usage |
|---|---|---|---|
| `--background` | `hsl(222, 47%, 6%)` | `hsl(0, 0%, 100%)` | Main application canvas |
| `--card` | `hsl(222, 47%, 9%)` | `hsl(0, 0%, 98%)` | Elevated panels & tables |
| `--primary` | `hsl(160, 84%, 39%)` (Emerald) | `hsl(160, 84%, 35%)` | Primary clinical actions & confirmation |
| `--foreground` | `hsl(210, 40%, 98%)` | `hsl(222, 47%, 11%)` | High-contrast readable typography |
| `--destructive` | `hsl(0, 84%, 60%)` (Rose) | `hsl(0, 72%, 51%)` | Critical cancellations & alerts |
