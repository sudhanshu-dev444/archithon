---
name: Field Clinical Utility
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#40484b'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#70787c'
  outline-variant: '#c0c8cb'
  surface-tint: '#306576'
  primary: '#003441'
  on-primary: '#ffffff'
  primary-container: '#0f4c5c'
  on-primary-container: '#87bbce'
  inverse-primary: '#9acee1'
  secondary: '#3a6472'
  on-secondary: '#ffffff'
  secondary-container: '#bbe7f7'
  on-secondary-container: '#3e6876'
  tertiary: '#660200'
  on-tertiary: '#ffffff'
  tertiary-container: '#881a0f'
  on-tertiary-container: '#ff9786'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b6ebfe'
  primary-fixed-dim: '#9acee1'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#114d5d'
  secondary-fixed: '#bee9fa'
  secondary-fixed-dim: '#a2cddd'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#204c5a'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410100'
  on-tertiary-fixed-variant: '#8a1c10'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  tabular-data:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system is engineered for community health workers, triage officers, and traveling clinicians operating in austere, remote, and bandwidth-deprived environments. The aesthetic marries high-reliability clinical instruments with functional utilitarian pragmatism. 

Key attributes:
- **Resilient & Low-Latency:** Visual density is disciplined; layouts avoid decorative clutter and prioritize rapid triage, single-hand touch accuracy, and high legibility under direct sunlight or extreme glare.
- **Unambiguous State Awareness:** Network connectivity, local caching, conflict resolution, and data safety must be unmistakably legible at a 2-foot viewing distance.
- **Tactile Reliability:** Components convey physical grounding through structured borders, tactile depression states, and assertive focal outlines to minimize mis-taps during active fieldwork.

## Colors
The palette balances antiseptic clinical precision with rigorous status signaling:

- **Primary & Secondary (`#0F4C5C`, `#0B3C49`):** Deep Clinical Teals designate primary navigation, structural anchoring, and confident workflow actions.
- **Tertiary & Emergency (`#E05A47`):** Coral-red provides unambiguous signaling for clinical emergencies, sync errors, hard conflicts, and destructive actions.
- **Warning & Attention (`#E08A00`):** High-visibility amber designates local-only non-synced states, partial telemetry, or pending sync batches.
- **Safe & Verified (`#16A34A`):** Deep clinical emerald flags cryptographically verified records, live backups, stable vitals, and completed uploads.
- **Neutrals & Surfaces:** Default light mode operates on crisp slate backgrounds (`#F8FAFC`, `#FFFFFF`) with stark slate borders (`#CBD5E1`) providing at least 4.5:1 text-to-background contrast across all informational surfaces.
- **Dark Mode Adaptation:** Dark mode flips surfaces to deep matte slate (`#0F172A` foundation, `#1E293B` containers) to cut glare during nighttime rounds or power outages, boosting saturation on status badges to maintain WCAG AAA compliance.

## Typography
Inter delivers robust legibility with generous x-height, wide apertures, and unmistakable numeric characters for tabular clinical telemetry.

- **Tabular Figures:** All numeric indicators, dosage counters, and vital telemetry must apply `font-feature-settings: "tnum" 1` to guarantee vertical decimal alignment across comparative tables.
- **Hierarchical Rigor:** Restrict headline scale on small-screen handhelds to maintain high information density above the fold while leaving room for primary action targets.
- **Labeling:** Metadata tags, sync indicators, and status indicators strictly employ `label-sm` or `label-md` with upper-register casing and tracking to prevent visual blending with patient data.

## Layout & Spacing
The layout leverages a fluid 4-column structure on mobile devices, expanding to an 8-column layout on field tablets.

- **Touch Surface Guarantees:** Any interactive hit box must never drop below 48px in height or width, even when visual badge boundaries appear smaller. Buttons and list selections scale to a 52px minimum height for one-handed operation.
- **Vertical Flow:** Standard component rhythm follows an 8px base increment (`space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px).
- **Split-Screen Resilience:** Tablets support dual-pane master-detail workflows (patient directory on the 3-column left pane; diagnostic intake on the 5-column right pane) with persistent offline status anchoring at the viewport baseline.

## Elevation & Depth
In field settings, diffused drop shadows wash out under harsh direct sunlight and introduce performance overhead on rugged low-spec chipsets.

- **High-Contrast Structural Borders:** Depth is generated via clean 1px and 2px borders (`#CBD5E1` in light mode, `#334155` in dark mode) paired with deliberate surface tinting.
- **Tonal Layers:** Elevated modular cards utilize surface distinction (`#FFFFFF` elevated card over `#F8FAFC` foundation). Secondary embedded sections use inset tinted tones (`#F1F5F9`).
- **Tactile Depress States:** Active card and button taps do not use expansive blur shifts; they drop 1px downwards via structural box-inset borders or instantaneous border-weight transitions.
- **Modal & Sheet Anchoring:** Critical alert dialogues and sync-conflict overlays use an opaque 60% neutral-slate scrim coupled with a crisp 2px solid border rather than fuzzy atmospheric elevation.

## Shapes
A disciplined "Soft" curvature level (0.25rem standard radii, up to 0.5rem on large card containers) preserves screen real estate and enforces a crisp, clinical character.

- **Corners:** Avoid bubbly, high-radius aesthetics. Sharp and precise edge termination reinforces mechanical reliability and maximizes usable content area on narrow screen widths.
- **Status Badges & Indicators:** Pill shapes are reserved strictly for high-visibility state badges (e.g., sync flags, triage category markers) to provide immediate cognitive differentiation from structural cards and interactive buttons.

## Components

### Buttons
- **Primary:** Background `#0F4C5C`, text `#FFFFFF`, minimum height 52px, radius 4px. Active state shifts background to `#0B3C49`. Focus/selected uses a 2px offset ring in `#0F4C5C`.
- **Destructive/Emergency:** Background `#E05A47`, text `#FFFFFF`, minimum height 52px. For high-urgency triage overrides and purge actions.
- **Secondary/Outline:** Background `#FFFFFF`, 1.5px border `#0F4C5C`, text `#0F4C5C`.
- **Tactile Feedback:** Visual depression with a solid 1px bottom accent line on primary controls to simulate mechanical reassurance.

### Status Badges
High-contrast pills (height 28px, minimum hit zone 48px when actionable) featuring an icon and uppercase text:
- **Offline:** Border `#64748B`, background `#F1F5F9`, text `#334155`.
- **Local-Only:** Border `#E08A00`, background `#FEF3C7`, text `#92400E`.
- **Synced:** Border `#16A34A`, background `#DCFCE7`, text `#14532D`.
- **Conflict:** Border `#E05A47`, background `#FEE2E2`, text `#991B1B`.
- **Verifying:** Border `#0F4C5C`, background `#E0F2FE`, text `#075985`.

### Cards & Clinical Containers
- Surfaces use `#FFFFFF` on `#F8FAFC` background with a crisp 1px solid border `#CBD5E1`.
- Card headers enforce a clear division: patient identifier and triage badge on top, vital stats tabular layout in the center, and a full-width 48px touch footer for clinical actions.
- Critical-patient variant: Employs a 4px left-hand border accent in `#E05A47` or `#E08A00`.

### Tabular Data & Vital Metrics
- Key-value metric blocks use monospace tabular numerals with explicit units displayed in `label-sm` muted slate.
- Alternating row zebra-striping is forbidden; rely instead on clean 1px bottom borders (`#E2E8F0`) with 12px vertical cell padding for swift row scanning.

### Input Fields & Selectors
- Text fields provide a 52px field height with an inset background of `#FFFFFF` and a 1.5px border `#94A3B8`.
- Focus state produces an immediate 2px `#0F4C5C` border with zero blur spread.
- Stepper controls (e.g., dosage counts, respiratory rates) feature split large 48x48px `+` and `−` tactile touch blocks flanking the numeric value.

### Checkboxes & Radio Controls
- Target size is padded to 48x48px with a visible glyph size of 24x24px.
- Checkboxes feature a 2px stroke border and high-contrast checked fill `#0F4C5C`. Radio targets display a distinct centered bullseye with 4px internal clearance.

### Sync Banner & Connectivity Drawer
- Sticky persistent banner fixed at the device viewport header or footer (height 36px) providing real-time local cache volume, pending queue counts, and connection vitality.