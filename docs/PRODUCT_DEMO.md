# 90-Second Product Demo & Screenshot Capture Specification

**Status:** `BLOCKED BY HUMAN CAPTURE`  
**Required Action:** Manual browser recording and screenshot capture on an authenticated staging environment by a human operator.  
**Target Delivery:** 7 real UI screenshots (1440×900) + 85–95s captioned walkthrough video.

---

## 1. Safety & Data Privacy Rules

1. **Zero Production Data:** All screenshots and video recordings must use purely synthetic/seeded clinic records. Never use real patients, real phone numbers, real medical records, or live WhatsApp chats.
2. **Deterministic Seed Data:** Fictional Indian names (e.g. *Aarav Sharma*, *Priya Patel*), standard dummy mobile numbers (e.g. `+91 98765 43210`), and sample clinic specialties (*General Medicine*, *Dentistry*, *Pediatrics*).
3. **No Mockups or AI-Generated Placeholders:** Every image must be captured directly from a running web browser against the authenticated staging application.
4. **Resolution & Optimization:** Screenshots at native `1440×900` resolution, lossless WebP/PNG compression, with text remaining crisp and readable.

---

## 2. Staging Environment Prerequisites

To perform capture, the operator requires:
- **Staging URL:** `https://staging.helpa.studio` (or local staging `http://localhost:3000`)
- **Seeded Clinic Account:** `citycare_clinic@example.com` (Role: `admin` / `owner`)
- **Seeded Doctors:** 
  - *Dr. Ananya Rao* (General Medicine, Mon-Fri 09:00-13:00)
  - *Dr. Rajesh Kumar* (Orthopedics, Mon-Wed-Fri 14:00-18:00)
- **Seeded Inbound Messages:** 3 realistic WhatsApp conversations (appointment enquiry, lab report status check, clinic hours query).

---

## 3. Seven Required Screenshots Checklist

| # | Product View | Target Path | Required Visual State | Status |
|---|---|---|---|:---:|
| 1 | **Clinic Dashboard Overview** | `public/assets/screenshots/01-clinic-dashboard.png` | Overview metrics cards, today's appointments list, active doctor counters, recent WhatsApp conversations. | ⏳ Awaiting Capture |
| 2 | **WhatsApp Inbox Enquiry** | `public/assets/screenshots/02-whatsapp-inbox-enquiry.png` | Two-pane inbox with active patient thread asking for an appointment with Dr. Rao. | ⏳ Awaiting Capture |
| 3 | **Doctor Slot Selection** | `public/assets/screenshots/03-doctor-slot-selection.png` | Appointment drawer showing available calendar slots for the selected doctor. | ⏳ Awaiting Capture |
| 4 | **Confirmed Appointment** | `public/assets/screenshots/04-confirmed-appointment.png` | Confirmed booking detail modal with appointment ID, time, and patient card. | ⏳ Awaiting Capture |
| 5 | **Reminder Preview** | `public/assets/screenshots/05-reminder-preview.png` | Automated WhatsApp reminder notification message preview with clinic branding. | ⏳ Awaiting Capture |
| 6 | **Staff Takeover Control** | `public/assets/screenshots/06-staff-takeover.png` | Live conversation showing AI paused badge, assigned receptionist, and staff message input. | ⏳ Awaiting Capture |
| 7 | **OPD Slip / Follow-Up** | `public/assets/screenshots/07-opd-slip-workflow.png` | OPD digital ticket / prescription slip preview with QR code and follow-up date badge. | ⏳ Awaiting Capture |

---

## 4. 90-Second Demo Storyboard & Timing

| Time Window | Scene Description | Voice-Over / Caption Text | Visual Action |
|:---:|---|---|---|
| **00:00 – 00:08** | Patient sends WhatsApp enquiry | *“Every missed message can become a missed appointment.”* | Patient WhatsApp interface sends: *“Hi, I need an appointment with Dr. Rao for tomorrow morning.”* |
| **00:08 – 00:20** | Helpa AI instant approved answer | *“Helpa responds instantly using clinic-approved FAQs and doctor schedules.”* | AI replies with doctor info and available morning slots. |
| **00:20 – 00:35** | Real-time availability check | *“It verifies real availability before offering a slot.”* | Patient selects `10:30 AM`; availability is validated instantly. |
| **00:35 – 00:48** | Confirmed appointment created | *“One reply turns a casual enquiry into a confirmed clinic visit.”* | Booking card generated with Booking ID `#HLP-8921`. |
| **00:48 – 01:00** | Automated confirmation & reminder | *“Patients receive clear confirmations and automated reminders on WhatsApp.”* | WhatsApp confirmation template sent with location and OPD token. |
| **01:00 – 01:12** | Receptionist inbox & staff takeover | *“Your team sees every conversation and can take over at any second.”* | Clinic dashboard shows conversation live; receptionist clicks *Take Over*. |
| **01:12 – 01:22** | OPD slip & follow-up management | *“Visit documents and follow-ups stay connected to the patient journey.”* | One-click OPD slip generation and scheduled follow-up reminder. |
| **01:22 – 01:30** | Outcome summary & CTA | *“Faster responses, zero lost leads, and a calmer front desk.”* | Dashboard metrics summary view with trial start CTA. |

---

## 5. Walkthrough Video Acceptance Criteria

- **Target Duration:** Exactly 85–95 seconds.
- **Resolution:** 1080p (1920×1080) at 30/60 fps.
- **Audio:** Clear English narration with zero background noise.
- **Captions:** WebVTT file (`public/assets/demo/walkthrough.vtt`) readable without audio.
- **Host Link:** Hosted on official repository release or dedicated CDN (`https://helpa.studio/demo`).
