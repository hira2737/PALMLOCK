# PALMLOCK — Touch Beyond Vision

> **An accessibility-first QR payment security and emergency assistance platform designed for blind and visually impaired users.**

---

# 1. Project Overview

## 1.1 What is PALMLOCK?

PALMLOCK is a mobile-first, accessibility-focused QR payment security and emergency assistance web application. It is designed to help visually impaired and low-vision individuals use QR-based payment systems more independently, securely, and confidently.

QR payments are convenient, but visually impaired users can face several practical challenges:

1. Difficulty locating and aligning a smartphone camera with a physical QR code.
2. Difficulty identifying whether a QR code belongs to the intended merchant.
3. Risk of entering an incorrect or manipulated payment amount.
4. Dependence on visible numeric keypads, which can expose PINs to nearby people.
5. Difficulty requesting emergency assistance discreetly when threatened or coerced.
6. Difficulty communicating their exact location to trusted contacts during an emergency.

PALMLOCK addresses these challenges through an accessible mobile application connected to a centralized backend and a separate administrator dashboard.

## 1.2 Main Objectives

- Make QR scanning more accessible through directional audio and haptic guidance.
- Allow users to verify merchant identity and payment amount before authorization.
- Replace ordinary visible PIN entry with a gesture-based numeric PIN.
- Provide a discreet Stealth Mode for private authentication.
- Provide a hidden Duress PIN to trigger emergency assistance.
- Capture GPS location and incident details with the user's permission.
- Notify trusted contacts and support escalation workflows.
- Provide administrators with an interactive map and an incident response dashboard.
- Maintain an offline-capable application experience wherever browser capabilities allow.

## 1.3 Six Core Innovations

1. **Directional QR Guidance:** Audio and vibration cues help users locate and align the camera with QR codes.
2. **Merchant and Amount Verification:** Spoken information and high-contrast displays help users verify transaction details.
3. **Gesture-Based Numeric PIN:** Each numeric digit is represented by a specific directional gesture or tap.
4. **OLED Black Stealth Mode:** A completely black interface allows discreet gesture interaction while reducing visible screen information.
5. **Silent Duress PIN:** A separate emergency gesture sequence triggers an emergency workflow while displaying a normal-looking failure or timeout screen.
6. **Security Operations Dashboard:** A desktop dashboard enables authorized operators to monitor emergency incidents, view location information, acknowledge alerts, and manage responses.

---

# 2. System Architecture

PALMLOCK consists of three connected layers:

### A. Mobile User Application

Path: `frontend/index.html`

A mobile-first application designed primarily for Android smartphones.

Responsibilities:
- Registration and login.
- Accessibility preferences.
- Trusted contact management.
- QR scanning and directional guidance.
- Merchant and amount verification.
- Gesture-based numeric PIN authentication.
- Stealth Mode.
- Simulated payment processing.
- Emergency Duress PIN activation.
- GPS location capture.
- Offline event queuing.
- Accessibility tutorials and practice mode.

### B. Administrator Dashboard

Path: `frontend/admin.html`

A separate desktop-first interface for authorized administrators and emergency operators.

Responsibilities:
- Monitor users and transactions.
- Receive emergency alerts.
- View incident details.
- Display incident locations on an interactive map.
- Monitor trusted-contact notification status.
- Acknowledge, escalate, and resolve incidents.
- Maintain response notes and incident timelines.
- Review incident and transaction records.

### C. Unified Backend and Database

Backend: Node.js, Express.js, Socket.IO.

Database: MongoDB with Mongoose.

Responsibilities:
- Authentication and authorization.
- Secure storage of users and trusted contacts.
- Gesture PIN verification.
- Merchant and payment request verification.
- Transaction records.
- Emergency incident creation.
- Location and telemetry storage.
- Notification and escalation workflows.
- Real-time dashboard updates.
- Audit logging.

### Architecture Flow

```text
                    PALMLOCK ECOSYSTEM
                            |
              +-------------+-------------+
              |                           |
              v                           v
       MOBILE USER APP              ADMIN DASHBOARD
       frontend/index.html          frontend/admin.html
              |                           |
              |                           |
              +-------------+-------------+
                            |
                            v
                   EXPRESS BACKEND
                  Node.js / Express
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
         REST APIs       Socket.IO     Security
             |          Real-time       Middleware
             |           Events
             +--------------+--------------+
                            |
                            v
                      MONGODB
                  Persistent Storage
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
           Users        Transactions    Emergency
          Contacts                       Alerts
```

Both interfaces must communicate with the same backend and database. They must not operate as unrelated applications.

---

# 3. Technology Stack

## 3.1 Frontend

- HTML5 — semantic application structure.
- CSS3 — responsive layouts and design system.
- Vanilla JavaScript (ES6+) — application logic and modules.
- CSS custom properties — consistent design tokens.
- Leaflet.js — interactive geographic maps.
- OpenStreetMap / CartoDB Dark Matter — map tile providers.
- JavaScript QR scanning library — camera-based QR recognition.
- Web Speech API — spoken instructions and transaction readouts.
- Web Audio API — synthesized audio cues and alerts.
- Vibration API — haptic feedback.
- MediaDevices API — camera access.
- Geolocation API — GPS location capture.
- Service Worker — offline application caching.
- IndexedDB — locally queued events and offline data.
- PWA manifest — installable application support.

## 3.2 Backend

- Node.js
- Express.js
- Socket.IO
- Mongoose
- Authentication middleware
- Password hashing
- Input validation
- Rate limiting
- Secure error handling

## 3.3 Database

MongoDB collections:

- Users
- TrustedContacts
- Merchants
- PaymentRequests
- Transactions
- EmergencyAlerts
- AuditLogs

## 3.4 Development and Testing

- VS Code
- Git and GitHub
- Antigravity for AI-assisted development
- Browser developer tools
- Playwright, where available, for browser automation and UI testing
- Android Chrome for real-device testing

**Important:** The project must remain based on HTML, CSS, and Vanilla JavaScript. Do not migrate it to React, Next.js, or another frontend framework.

---

# 4. Complete Project Folder Structure

```text
PALMLOCK/
|
|-- README.md
|-- PROJECT_STATUS.md
|-- .gitignore
|-- package.json
|
|-- frontend/
|   |
|   |-- index.html
|   |-- admin.html
|   |-- manifest.json
|   |-- service-worker.js
|   |-- package.json
|   |
|   |-- css/
|   |   |-- user.css
|   |   |-- admin.css
|   |
|   |-- js/
|   |   |
|   |   |-- user/
|   |   |   |-- app.js
|   |   |   |-- state.js
|   |   |   |-- accessibility.js
|   |   |   |-- navigation.js
|   |   |   |-- gestures.js
|   |   |   |-- scanner.js
|   |   |   |-- payments.js
|   |   |   |-- contacts.js
|   |   |   |-- tutorial.js
|   |   |   |-- location.js
|   |   |   |-- offline-queue.js
|   |   |   |-- api.js
|   |   |
|   |   |-- admin/
|   |       |-- admin.js
|   |       |-- state.js
|   |       |-- audio.js
|   |       |-- overview.js
|   |       |-- alerts.js
|   |       |-- incident_details.js
|   |       |-- users.js
|   |       |-- transactions.js
|   |       |-- map.js
|   |
|   |-- assets/
|       |-- images/
|       |-- screenshots/
|       |-- videos/
|       |-- icons/
|
|-- backend/
|   |
|   |-- server.js
|   |-- package.json
|   |-- .env
|   |-- .env.example
|   |
|   |-- config/
|   |-- models/
|   |-- routes/
|   |-- middleware/
|   |-- services/
|   |-- sockets/
|
|-- test/
    |-- verify_ui.mjs
    |-- verify_syntax.mjs
    |-- unit_logic.mjs
    |-- verify_admin.mjs
    |-- verify_map.mjs
    |-- verify_api.mjs
    |-- verify_integration.mjs
```

The folder structure may be expanded when implementation requires additional modules, but existing responsibilities and the overall architecture must be preserved.

---

# 5. Mobile User Application — Complete Requirements

Entry point: `frontend/index.html`

The mobile application must use a single-page navigation structure with separate screens managed through JavaScript.

## 5.1 Welcome Screen

- PALMLOCK branding.
- Application introduction.
- Accessibility-focused welcome message.
- Login and registration navigation.
- Clear instructions for first-time users.

## 5.2 Registration and Login

- User registration.
- Login.
- Name and contact information.
- Secure password handling through the backend.
- Input validation.
- Session management.
- Accessible labels and error messages.

No real passwords or PINs must be stored in plain text in frontend code or local storage.

## 5.3 Initial Permission and Setup Flow

The application must explain why permissions are needed and request them when the related feature is first used.

Required permissions and capabilities:

| Permission / Capability | Purpose |
|---|---|
| Camera | QR scanning |
| Location | Emergency GPS location |
| Browser notifications | Optional notification support, where supported |
| Audio output | Spoken instructions and cues |
| Vibration | Haptic feedback |
| Accessibility settings | Screen-reader-friendly interaction |

Important implementation rules:

- Do not request every permission immediately on the welcome screen.
- Request camera access when the user starts scanning.
- Request location access when setting up or activating an emergency-related feature that needs it.
- Explain the purpose before displaying the browser permission request.
- Handle denied permissions gracefully.
- Provide a usable fallback wherever possible.
- PALMLOCK does not require microphone access for ordinary speech synthesis.
- Android Voice Access and TalkBack are operating-system accessibility features. PALMLOCK should support them through accessible HTML and ARIA rather than pretending to control or request them directly.

## 5.4 User Setup

- Basic profile setup.
- Primary trusted contact.
- Secondary trusted contact.
- Contact details and relationship.
- Contact verification status.
- Location permission explanation.
- Accessibility preference selection.
- Gesture PIN setup.

## 5.5 Home Dashboard

The home screen should provide clear access to:

- Scan QR Code.
- Transaction History.
- Trusted Contacts.
- Accessibility Tutorial.
- Practice Mode.
- Accessibility Settings.
- Emergency PIN information.

The home screen must remain simple and easy to navigate without relying only on visual icons.

## 5.6 QR Scanner and Directional Guidance

The application must support camera-based QR scanning.

Required behaviour:

1. Request camera permission when scanning begins.
2. Start the camera stream.
3. Detect a QR code.
4. Provide guidance when the QR code is not positioned correctly.
5. Recognize when the QR code is centered and readable.
6. Read the decoded payment request.
7. Verify the merchant and amount through the backend.
8. Move to the payment verification screen.

### Directional Guidance

Use a combination of speech and haptic patterns.

Examples:

- Move left.
- Move right.
- Move closer.
- Move farther away.
- QR code detected.
- QR code aligned.

The scanner should provide simple directional feedback rather than claiming to provide advanced radar or distance measurement when the underlying QR library cannot reliably provide it.

Provide an audio fallback if vibration is unavailable.

## 5.7 Merchant Verification and Amount Confirmation

After scanning:

- Display merchant name.
- Display merchant identity or verification status.
- Display requested amount.
- Display payment reference or request identifier.
- Read important information aloud.
- Allow the user to confirm or cancel.
- Never allow the scanner's displayed merchant name alone to establish trust.
- Retrieve trusted merchant and payment request details from the backend.

The user must be able to review the transaction before entering the PIN.

## 5.8 Gesture-Based Numeric PIN Authentication

This is one of PALMLOCK's most important features.

The user must not have to depend on a visible numeric keypad.

Each numeric digit from 0 to 9 must have its own distinct gesture.

### Gesture Vocabulary

Use eight directional swipe gestures and two tap gestures:

| Digit | Gesture |
|---|---|
| 1 | Swipe Up |
| 2 | Swipe Up-Right |
| 3 | Swipe Right |
| 4 | Swipe Down-Right |
| 5 | Swipe Down |
| 6 | Swipe Down-Left |
| 7 | Swipe Left |
| 8 | Swipe Up-Left |
| 9 | Single Tap |
| 0 | Double Tap |

The gesture engine must distinguish directions and taps using appropriate movement-distance and timing thresholds.

### Required Gesture PIN Behaviour

- Support all ten numeric gestures.
- Capture gestures in sequence.
- Convert each gesture into its associated numeric digit internally.
- Display only masked PIN indicators.
- Provide haptic confirmation after each accepted gesture.
- Provide an optional audio cue.
- Support undo.
- Support clear.
- Support confirmation and cancellation.
- Verify the resulting PIN securely through the backend.
- Do not store the actual PIN in plaintext.
- Prevent accidental gestures from being interpreted as valid PIN input.

### Gesture Practice

Provide a practice mode where users can learn and test each digit gesture before setting their PIN.

The tutorial must explain all ten gesture mappings.

### Important Separation

Normal payment PIN authentication and Duress PIN authentication must be handled as separate credential outcomes.

The Duress PIN must not be revealed to the user through ordinary transaction feedback.

## 5.9 OLED Black Stealth Mode

Stealth Mode must:

- Use a completely black `#000000` screen.
- Hide unnecessary visual information.
- Allow gesture interaction.
- Support gesture-based authentication.
- Provide discreet haptic feedback.
- Avoid bright animations and obvious authentication indicators.
- Offer appropriate audio behaviour based on the user's accessibility preferences.

The mode is a visual privacy feature. It does not physically turn off the phone display or guarantee that the device appears powered off.

## 5.10 Payment Processing Demonstration

For the current project demonstration, payments must be simulated.

Expected flow:

1. Scan QR.
2. Retrieve payment request.
3. Verify merchant and amount.
4. Ask the user to confirm.
5. Capture gesture PIN.
6. Verify PIN through the backend.
7. Simulate transaction success or failure.
8. Generate a transaction reference.
9. Save the transaction record.
10. Display and speak the result.

Provide:

- Payment success screen.
- Payment failure screen.
- Cancellation state.
- Transaction reference.
- Transaction history.

**Scope limitation:** PALMLOCK does not process real UPI transfers or move actual money. Real payment gateway integration is future scope and requires an authorized payment provider.

## 5.11 Duress PIN and Emergency Activation

A dedicated emergency PIN must be configured separately from the normal PIN.

### Duress Gesture Sequence

```text
Down → Down → Left → Left
```

When the user enters the configured Duress PIN:

- Do not display a clear emergency warning.
- Display a normal-looking banking timeout or transaction failure message.
- Create an emergency incident record.
- Capture the current GPS location if permission is available.
- Record the location accuracy and capture time.
- Record the user's identity.
- Record the incident timestamp.
- Record available network status.
- Notify the primary trusted contact through the configured notification provider.
- Send the emergency event to the administrator dashboard.
- Provide a discreet acknowledgement to the user.

The Duress PIN must not behave like a normal failed PIN.

### Emergency Incident Information

Each incident should contain:

- Incident ID.
- User ID.
- Event type: `DURESS`.
- Latitude and longitude, if available.
- Location accuracy.
- Location timestamp.
- Incident creation timestamp.
- Current network status.
- Primary contact notification status.
- Secondary contact notification status.
- Administrator acknowledgement status.
- Incident status.
- Escalation stage.
- Response notes.
- Resolution timestamp.

## 5.12 Trusted Contacts and Emergency Escalation

Users must be able to configure:

- Primary trusted contact.
- Secondary trusted contact.

Each contact should have:

- Name.
- Phone number.
- Relationship.
- Verification status.
- Notification status.

### Escalation Workflow

**Stage 1 — Immediate Alert**

- Emergency event is recorded.
- Primary trusted contact is notified.
- Administrator dashboard receives the incident.

**Stage 2 — Five-Minute Escalation**

- If the primary contact has not acknowledged the alert within five minutes, attempt to notify the secondary contact.

**Stage 3 — Ten-Minute Escalation**

- If the incident remains unacknowledged, an authorized administrator or designated operator can follow the documented emergency response procedure and use an appropriate official emergency channel.

All escalation times and acknowledgement states must be recorded.

**Important limitations:**

- Actual SMS or OTP delivery requires a configured SMS/notification provider.
- The application must not falsely display an SMS or OTP as delivered when no provider confirms delivery.
- A browser application cannot silently send SMS through the phone's SIM.
- Direct emergency number integration, including 112, is future scope and requires appropriate authorization and technical arrangements.
- If there is no internet or cellular connectivity, remote notification cannot be guaranteed.

## 5.13 Accessibility Tutorial

The application must provide an interactive, step-by-step tutorial covering:

1. Introduction to PALMLOCK.
2. QR scanning.
3. Directional audio guidance.
4. Haptic feedback patterns.
5. All ten gesture-to-digit mappings.
6. Gesture PIN setup.
7. Normal PIN authentication.
8. Stealth Mode.
9. Duress PIN.
10. Trusted contacts.
11. Emergency assistance workflow.

Additional tutorial features:

- Practice mode.
- Repeat instructions.
- Spoken explanations.
- Clear progress indicators.
- Accessible navigation.
- Video placeholder for future instructional videos.

## 5.14 Accessibility Settings

Provide controls for:

- Speech guidance on/off.
- Speech rate.
- Haptic feedback on/off.
- Audio cues on/off.
- Font scaling.
- High-contrast display.
- Reduced motion.
- Stealth Mode preference.
- Tutorial access.

The application must support TalkBack, Android Voice Access, keyboard navigation where applicable, and screen-reader announcements.

## 5.15 Transaction History

Display:

- Transaction reference.
- Merchant.
- Amount.
- Date and time.
- Transaction status.

Provide search and filtering where practical.

---

# 6. GPS and Geographic Mapping System

Geographic mapping is an important part of the emergency response system.

The map must be visually polished, professional, interactive, and suitable for an emergency operations dashboard.

## 6.1 Mapping Technology

Primary implementation:

- Leaflet.js.
- OpenStreetMap or CartoDB Dark Matter map tiles.
- Custom incident markers.
- Custom location popups.
- Interactive zoom and pan.
- Location accuracy circles.

The existing dark SOC dashboard design should use a map theme that visually fits the rest of the interface.

A Google Maps implementation may be considered if API access, key configuration, usage limits, and billing requirements are acceptable. Do not introduce a paid dependency without documenting it.

## 6.2 GPS Location Capture

Use the browser Geolocation API.

When an emergency is activated:

1. Check whether location permission is available.
2. Request location access if necessary.
3. Retrieve latitude and longitude.
4. Retrieve location accuracy.
5. Record the timestamp.
6. Send available coordinates to the backend.
7. Associate the location with the incident.

If permission is denied or GPS is unavailable:

- Still create the emergency incident.
- Mark location as unavailable.
- Explain the limitation in the dashboard.
- Never invent or silently substitute coordinates.

## 6.3 Administrator Incident Map

The administrator must be able to see:

- Incident location.
- Incident marker.
- Location accuracy radius.
- User information.
- Incident timestamp.
- Merchant information when relevant.
- Incident status.

The map should support:

- Zooming.
- Panning.
- Marker selection.
- Location popups.
- Re-centering on an incident.
- Clear location status.
- Map attribution.
- A usable offline fallback.

A selected incident should update the incident details and map together.

## 6.4 Map Accuracy and Privacy

- Real user coordinates must only come from permitted location capture.
- Demo coordinates must be clearly labelled as demonstration data.
- Do not present a hardcoded example coordinate as a real user's location.
- Store only the location information necessary for the incident workflow.
- Protect location information from unauthorized users.

---

# 7. Offline Support and Network Handling

PALMLOCK should remain usable during temporary connectivity problems.

## 7.1 Service Worker

- Cache essential application files.
- Allow previously loaded application screens to open offline.
- Cache required styles, scripts, icons, and static resources.
- Handle cache updates safely.

## 7.2 IndexedDB

Use IndexedDB for appropriate locally queued events, such as:

- Pending emergency event submissions.
- Pending synchronization tasks.
- Temporary transaction demonstration records.

## 7.3 Reconnection

When connectivity returns:

- Retry queued events.
- Prevent duplicate emergency incident creation.
- Update synchronization status.
- Remove successfully synchronized events from the queue.
- Report failed synchronization clearly.

**Important:** Offline caching does not mean remote emergency notification is possible without a working network. The application must never claim that a remote contact or administrator has received an alert until delivery is confirmed.

---

# 8. Administrator Dashboard — Complete Requirements

Entry point: `frontend/admin.html`

The dashboard must be a separate, desktop-first Security Operations Center (SOC) interface.

It should have a sophisticated cybersecurity and incident-response design, not a generic admin template.

## 8.1 Design and Navigation

- Professional dark interface.
- Collapsible sidebar.
- Clear active navigation.
- Top command bar.
- Global search.
- Operator profile.
- System operational status.
- Alert siren controls.
- Mobile application launch link.
- Responsive layout.

## 8.2 Overview Dashboard

Display four primary KPI cards:

1. Active Alerts.
2. Monitored Users.
3. Total Transaction Volume.
4. Resolved Incidents.

Additional sections:

- Active incident stream.
- Severity distribution.
- Recent system activity.
- Incident status summary.
- Emergency notification activity.

All demonstration metrics must be clearly identified as simulated until connected to the backend.

## 8.3 Emergency Alerts

Display an emergency alert table with:

- Incident ID.
- User.
- Event type.
- Severity.
- Location availability.
- Created time.
- Contact notification status.
- Administrator acknowledgement.
- Incident status.

Provide:

- Filtering.
- Search.
- Severity labels.
- Status labels.
- Quick acknowledgement.
- Incident inspection.

## 8.4 Incident Details

Each incident must have a detailed view containing:

### A. Interactive Geographic Map

- Leaflet map.
- Dark map theme.
- Actual incident coordinates when available.
- Custom incident marker.
- Pulsing marker where appropriate.
- Location accuracy circle.
- Interactive location popup.
- Zoom controls.
- Re-centering.
- Map attribution.
- Offline or unavailable-location fallback.

### B. Forensic User and Incident Dossier

- User identity.
- Contact details.
- Incident ID.
- Incident type.
- Location.
- Location accuracy.
- Incident timestamp.
- Network status.
- Merchant information where relevant.

### C. Trusted Guardian Status

- Primary contact.
- Secondary contact.
- Notification attempt status.
- Delivery confirmation.
- Acknowledgement status.
- Escalation stage.

### D. Response Management

Provide functional controls for:

- Acknowledge.
- Escalate.
- Resolve.

Each action must update the incident state and create an audit entry.

### E. Operator Response Notes

- Add response notes.
- Display previous notes.
- Record operator identity.
- Record timestamps.

### F. Incident Audit Timeline

Display a chronological history of:

- Incident creation.
- Location capture.
- Notification attempts.
- Contact acknowledgements.
- Administrator acknowledgement.
- Escalation.
- Resolution.

## 8.5 User Management

Provide:

- User directory.
- Search.
- Filtering.
- User profile details.
- Contact information.
- Account status.
- Accessibility-related preferences where appropriate.

Protect sensitive user data through role-based access.

## 8.6 Transaction Audit

Display:

- Transaction reference.
- User.
- Merchant.
- Amount.
- Date and time.
- Transaction status.

Provide:

- Search.
- Filtering.
- Transaction details.
- Audit information.

Do not describe simulated transactions as real financial transfers.

## 8.7 Real-Time Dashboard Updates

Use Socket.IO to receive backend events.

When a new emergency incident is created:

- Add it to the active alert stream.
- Update the active alert count.
- Display the incident notification.
- Update the incident map and details.
- Play an alert sound if enabled.
- Update the activity feed.

The dashboard must also handle connection loss and reconnection.

---

# 9. Backend Architecture and API Requirements

The backend will be implemented using Node.js, Express.js, MongoDB, Mongoose, and Socket.IO.

## 9.1 Authentication APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Authenticate a user |
| POST | `/api/auth/logout` | End a session |
| GET | `/api/auth/me` | Retrieve authenticated user |

Include secure password hashing, session/token management, input validation, and authorization.

## 9.2 Trusted Contact APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/contacts` | Add a trusted contact |
| GET | `/api/contacts` | Retrieve contacts |
| PATCH | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Remove contact |
| POST | `/api/contacts/verify` | Verify contact through configured verification service |

## 9.3 Gesture PIN APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/pin/setup` | Configure normal and duress credentials |
| POST | `/api/pin/verify` | Verify a submitted credential |

PIN verification must distinguish normal authentication, duress activation, and invalid authentication without exposing the stored credentials.

## 9.4 Merchant and Payment APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/merchants/:id` | Retrieve merchant information |
| GET | `/api/payment-requests/:id` | Retrieve trusted payment request |
| POST | `/api/transactions/simulate` | Simulate a transaction |
| GET | `/api/admin/transactions` | Retrieve administrator transaction records |

QR codes should contain a payment request identifier or trusted payment URL, not an amount and merchant identity that the application blindly trusts.

## 9.5 Emergency APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/alerts/duress` | Create a duress incident |
| GET | `/api/admin/alerts` | Retrieve emergency incidents |
| GET | `/api/admin/alerts/:id` | Retrieve incident details |
| PATCH | `/api/admin/alerts/:id/status` | Update incident status |
| POST | `/api/admin/alerts/:id/acknowledge` | Acknowledge incident |
| POST | `/api/admin/alerts/:id/notes` | Add response notes |

## 9.6 Real-Time Events

Socket.IO should support appropriate authenticated events, including:

- New emergency incident.
- Incident acknowledgement.
- Incident escalation.
- Incident resolution.
- Notification status updates.
- Dashboard data updates.

Only authorized administrators should receive sensitive incident information.

---

# 10. MongoDB Data Models

## 10.1 User

- Name.
- Email or username.
- Phone number.
- Password hash.
- Account status.
- Accessibility preferences.
- Created timestamp.

## 10.2 TrustedContact

- User ID.
- Contact name.
- Phone number.
- Relationship.
- Contact priority.
- Verification status.

## 10.3 Merchant

- Merchant identifier.
- Merchant name.
- Verification status.
- Merchant details.

## 10.4 PaymentRequest

- Request identifier.
- Merchant ID.
- Amount.
- Currency.
- Request status.
- Expiry time.

## 10.5 Transaction

- Transaction reference.
- User ID.
- Merchant ID.
- Payment request ID.
- Amount.
- Status.
- Created timestamp.

## 10.6 EmergencyAlert

- Incident ID.
- User ID.
- Event type.
- Latitude.
- Longitude.
- Location accuracy.
- Location timestamp.
- Network status.
- Primary contact status.
- Secondary contact status.
- Administrator acknowledgement.
- Incident status.
- Escalation stage.
- Response notes.
- Created timestamp.
- Resolved timestamp.

## 10.7 AuditLog

- Actor ID.
- Actor role.
- Action.
- Related incident or transaction.
- Timestamp.
- Relevant status changes.

---

# 11. Security and Privacy Requirements

Security is essential because PALMLOCK handles sensitive authentication and emergency location information.

Required measures:

- Hash passwords securely.
- Never store passwords or PINs as plaintext.
- Validate and sanitize incoming data.
- Use authentication middleware.
- Enforce administrator role checks.
- Protect sensitive API routes.
- Apply rate limiting.
- Prevent duplicate emergency event creation.
- Validate location data.
- Protect against unauthorized incident access.
- Avoid exposing credentials in frontend code.
- Keep secrets in environment variables.
- Exclude `.env` from Git.
- Use HTTPS for deployment.
- Maintain appropriate audit logs.
- Avoid unnecessary storage of sensitive personal information.

Location access and notification status must be handled transparently.

---

# 12. Browser and Device Compatibility

Some features require browser permissions and device support.

| Feature | Requirement |
|---|---|
| Camera | Browser camera permission |
| GPS | Browser location permission |
| Vibration | Device and browser Vibration API support |
| Speech | Web Speech API support |
| Offline caching | Service Worker support |
| Offline event queue | IndexedDB support |
| Live dashboard | Internet connection and Socket.IO |
| Camera and GPS on mobile | HTTPS secure context |

Localhost may be used for development. Android phone testing should use a secure HTTPS deployment or development tunnel.

Vibration patterns and camera performance must be tested on an actual Android device rather than assumed to work identically across browsers.

---

# 13. Development Phases and Completion Plan

The project will be completed in clearly separated phases.

## Phase 1 — Mobile User Frontend

**Path:** `frontend/index.html`

Requirements:

- Welcome.
- Registration and login screens.
- User setup.
- Trusted contacts interface.
- Home dashboard.
- QR scanner interface.
- Merchant and amount verification.
- Ten-digit gesture PIN system.
- Gesture practice.
- Stealth Mode.
- Simulated payment success and failure.
- Transaction history.
- Duress PIN interface.
- Accessibility tutorial.
- Accessibility settings.
- Permission explanation and handling.

The frontend may initially use demonstration data, but each feature must be clearly labelled as a demonstration until connected to the backend.

## Phase 2 — Administrator Frontend

**Path:** `frontend/admin.html`

Requirements:

- Professional SOC dashboard.
- Overview metrics.
- Emergency alerts.
- Incident details.
- Interactive Leaflet map.
- GPS location display.
- User management.
- Transaction audit.
- Response actions.
- Notes and timeline.
- Real-time interface integration points.

## Phase 2.1 — Frontend Refinement and Verification

Before backend development, verify both interfaces.

- Complete missing screens and interactions.
- Correct gesture mappings.
- Improve map presentation and location states.
- Verify responsive behaviour.
- Verify keyboard and screen-reader accessibility.
- Verify camera, audio, and haptic fallback states.
- Remove misleading demo claims.
- Test frontend navigation.
- Test all frontend modules.
- Fix visual and functional defects.

**Frontend completion must mean that the agreed frontend requirements have been implemented and tested, not merely that the pages look complete.**

## Phase 3 — Backend Development

- Initialize backend dependencies.
- Configure Express.
- Configure environment variables.
- Create middleware.
- Implement authentication.
- Implement trusted contacts.
- Implement PIN verification.
- Implement merchant and payment request APIs.
- Implement simulated transaction APIs.
- Implement emergency alert APIs.
- Implement administrator APIs.
- Implement Socket.IO.

## Phase 4 — MongoDB Integration

- Configure MongoDB connection.
- Create Mongoose schemas.
- Implement data persistence.
- Implement validation.
- Implement secure credential storage.
- Implement incident and transaction history.

## Phase 5 — Frontend and Backend Integration

Connect both interfaces to the backend.

- Registration and login.
- Trusted contact management.
- PIN setup and verification.
- Merchant verification.
- Payment request retrieval.
- Transaction simulation.
- Duress activation.
- GPS location submission.
- Administrator incident retrieval.
- Incident response updates.
- Real-time Socket.IO notifications.

## Phase 6 — Emergency Workflow Integration

Verify the complete emergency workflow:

1. User activates Duress PIN.
2. Backend verifies the emergency credential.
3. Emergency incident is created and stored.
4. Location information is attached when available.
5. Primary contact notification is attempted.
6. Administrator dashboard receives the incident.
7. Administrator can acknowledge and manage it.
8. Secondary contact escalation is attempted after five minutes if required.
9. Ten-minute escalation procedure is available to the authorized operator.
10. All actions are recorded in the incident timeline.

## Phase 7 — Testing and Deployment

- Test on Android Chrome.
- Test camera access.
- Test QR scanning.
- Test gesture recognition.
- Test all ten digit mappings.
- Test normal PIN and Duress PIN.
- Test Stealth Mode.
- Test GPS capture.
- Test map accuracy and markers.
- Test contact notification integration.
- Test administrator acknowledgement and escalation.
- Test Socket.IO reconnection.
- Test offline caching and synchronization.
- Test permission denial and fallback behaviour.
- Test security and authorization.
- Deploy frontend and backend.
- Configure production environment variables.
- Document installation and usage.

---

# 14. Testing Strategy

Testing must be based on actual implementation and execution.

Suggested test files:

| Test file | Responsibility |
|---|---|
| `verify_ui.mjs` | Mobile screen structure and accessibility |
| `verify_syntax.mjs` | JavaScript syntax validation |
| `unit_logic.mjs` | Gesture matching and application logic |
| `verify_admin.mjs` | Admin dashboard structure and actions |
| `verify_map.mjs` | Map container, coordinates, and location rendering |
| `verify_api.mjs` | Backend API verification |
| `verify_integration.mjs` | End-to-end frontend and backend workflows |

Tests must not be reported as passed unless they have actually been executed successfully.

---

# 15. Important Scope and Feasibility Notes

The following limitations must be respected throughout development.

1. **Real payments:** The current project is a payment simulation. Real UPI processing requires authorized payment integration.
2. **SMS delivery:** Real SMS requires an external provider. The application cannot silently send SMS through the SIM.
3. **OTP verification:** Actual OTP delivery requires a configured provider.
4. **Emergency services:** Direct 112 integration is not assumed. It requires authorization and a suitable integration arrangement.
5. **GPS:** Location is available only when the device, browser, permissions, and environment support it.
6. **Offline emergency delivery:** Offline storage can queue events, but cannot guarantee remote delivery without connectivity.
7. **Vibration:** Support varies by device and browser.
8. **Stealth Mode:** A black screen does not physically power off the phone.
9. **Voice Access:** Android Voice Access is an operating-system feature. PALMLOCK must provide accessible controls rather than claiming to implement Voice Access itself.
10. **Map providers:** OpenStreetMap and CartoDB tiles depend on network access unless an appropriate offline map solution is added.
11. **Location accuracy:** The map must display the reported GPS accuracy rather than imply that every location is exact.

---

# 16. UI/UX and Design Quality Standards

PALMLOCK must look like a professionally designed accessibility and security product.

## Mobile Interface

- Accessibility-first.
- Clear visual hierarchy.
- High contrast.
- Large touch targets.
- Readable typography.
- Simple navigation.
- Screen-reader support.
- Consistent spacing.
- Purposeful audio and haptic feedback.
- Responsive mobile layout.
- No unnecessary visual clutter.

## Administrator Interface

- Professional SOC appearance.
- Strong information hierarchy.
- Clear incident severity.
- High-quality interactive maps.
- Readable data tables.
- Consistent status indicators.
- Useful timelines and incident details.
- Responsive desktop layout.
- Clear response controls.

## Design Development Tools

Use available and relevant design tools and skills when developing or refining the frontend:

- UI/UX Pro Max for design-system guidance and interface quality.
- Frontend Design skill where available.
- Playwright for browser testing where available.
- 21st.dev MCP only when a suitable component or design reference is useful and compatible with the existing stack.

Do not introduce React-based libraries or dependencies that conflict with the agreed Vanilla JavaScript architecture.

Avoid generic AI-generated layouts, excessive gradients, random colourful cards, unnecessary glassmorphism, childish styling, and animation that interferes with accessibility.

---

# 17. Development Documentation Rules

`README.md` is the master project blueprint.

`PROJECT_STATUS.md` is the live development tracking document.

Every Antigravity development task must follow these rules:

1. Read `README.md` before starting work.
2. Implement only the requested phase or task.
3. Preserve all requirements in the master blueprint.
4. Do not silently remove or replace planned features.
5. Do not change the agreed technology stack without approval.
6. Update `PROJECT_STATUS.md` after every task.
7. Update `README.md` only when an approved project-plan change is required.
8. Record files created or modified.
9. Record tests actually executed and their results.
10. List incomplete features, known issues, and dependencies.
11. Never mark an unimplemented feature as complete.
12. Never claim that a simulated feature is a real integrated service.
13. Do not begin the next development phase without approval.

The completion report for each task must include:

- What was implemented.
- Files created or modified.
- Tests executed.
- Test results.
- Known issues.
- Pending requirements.
- Recommended next task.

---

# 18. Final Expected Outcome

The final PALMLOCK system should demonstrate a complete connection between an accessible mobile application, a secure backend, a persistent database, and a professional administrator dashboard.

The central demonstration workflow is:

```text
USER OPENS PALMLOCK
        |
        v
SCANS MERCHANT QR CODE
        |
        v
RECEIVES DIRECTIONAL GUIDANCE
        |
        v
VERIFIES MERCHANT AND AMOUNT
        |
        v
AUTHENTICATES USING GESTURE PIN
        |
        v
SIMULATED PAYMENT COMPLETES
        |
        v
TRANSACTION IS RECORDED
```

The emergency workflow is:

```text
USER ENTERS DURESS PIN
        |
        v
NORMAL-LOOKING FAILURE SCREEN
        |
        v
BACKEND IDENTIFIES DURESS EVENT
        |
        v
EMERGENCY INCIDENT IS STORED
        |
        v
GPS LOCATION IS ATTACHED IF AVAILABLE
        |
        +-----------------------+
        |                       |
        v                       v
PRIMARY CONTACT           ADMIN DASHBOARD
NOTIFICATION ATTEMPT      RECEIVES INCIDENT
        |                       |
        v                       v
NO ACKNOWLEDGEMENT?       OPERATOR ACKNOWLEDGES
        |                       |
        v                       v
5-MINUTE SECONDARY        INCIDENT MANAGEMENT
CONTACT ESCALATION        AND RESPONSE NOTES
        |
        v
10-MINUTE OPERATOR
ESCALATION PROCEDURE
```

**PALMLOCK's final objective:** Give visually impaired users a more accessible and discreet way to verify QR payment requests, authenticate without relying on visible numeric keypads, and request emergency assistance while providing authorized responders with useful incident and location information.