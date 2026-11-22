---
name: Intelligent Nature
colors:
  surface: '#edfdf3'
  surface-dim: '#ceded4'
  surface-bright: '#edfdf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e7f7ee'
  surface-container: '#e2f2e8'
  surface-container-high: '#dcece2'
  surface-container-highest: '#d6e6dd'
  on-surface: '#111e19'
  on-surface-variant: '#3f4942'
  inverse-surface: '#26332d'
  inverse-on-surface: '#e5f5eb'
  outline: '#6f7a71'
  outline-variant: '#bfc9c0'
  surface-tint: '#186c45'
  primary: '#005131'
  on-primary: '#ffffff'
  primary-container: '#176b45'
  on-primary-container: '#99e9b9'
  inverse-primary: '#88d7a8'
  secondary: '#006d42'
  on-secondary: '#ffffff'
  secondary-container: '#7ef7b3'
  on-secondary-container: '#007145'
  tertiary: '#4c28ad'
  on-tertiary: '#ffffff'
  tertiary-container: '#6445c6'
  on-tertiary-container: '#dcd1ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a4f4c3'
  primary-fixed-dim: '#88d7a8'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005232'
  secondary-fixed: '#81fab6'
  secondary-fixed-dim: '#64dd9b'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005230'
  tertiary-fixed: '#e7deff'
  tertiary-fixed-dim: '#ccbdff'
  on-tertiary-fixed: '#1f005f'
  on-tertiary-fixed-variant: '#4d2aae'
  background: '#edfdf3'
  on-background: '#111e19'
  surface-variant: '#d6e6dd'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Manrope
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
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
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-trust, nature-infused technological bridge for agricultural and aquaculture operations. Built for field resilience, the design balances agrarian dependability with the precision of predictive artificial intelligence. The aesthetic merges clean organic modernism with high-legibility utilitarian structures, ensuring interfaces remain readable under direct outdoor sunlight while conveying a premium, calibrated precision.

Key emotional anchors:
- **Trustworthy & Resilient:** Sturdy layouts, high-contrast indicators, and generous touch parameters reassure operators during critical monitoring cycles.
- **Scientific Vitality:** Foliage and deep canopy tones ground the product in biological growth, while focused optical purple moments denote machine intelligence and telemetry analysis.
- **Accessible Sophistication:** High-density insights distilled into ergonomic, low-friction mobile flows suited for diverse field literacy and multilingual contexts.

## Colors

The palette directly reflects biological systems paired with high-performance computation. Color roles are strictly partitioned to prevent visual pollution in complex field telemetry.

- **Primary Forest Green (`#176B45`):** Anchor for navigation headers, primary tactical actions, brand framing, and baseline positive status indicators.
- **Secondary Emerald Green (`#20A66A`):** Used for interactive triggers, dynamic sensor metrics, active toggle states, and confirmation feedback.
- **Accent Fresh Lime (`#B7E36A`):** High-visibility punch color for key focal points, badges, dynamic growth rings, and contrast accents on dark surfaces.
- **AI Accent Purple (`#6546C7`):** Reserved exclusively for machine learning inference, automated predictions, sensor diagnostics, and predictive yield insights.
- **Background & Canvas (`#F7FAF7`):** A soft, organic neutral tint that prevents screen glare in high-sunlight outdoor usage.
- **Surface & Cards (`#FFFFFF`):** Crisp white modular layers isolating data blocks from the field canvas.
- **Text & Structure:** Deep Chlorophyll (`#17251D`) provides strict WCAG AAA conformance for base reading, supported by Muted Foliage (`#718078`) for labels and metadata, bounded by Pale Meadow (`#E3EBE5`) for structural partitioning.

## Typography

Typography prioritizes glanceability, multi-script legibility, and information density across harsh operating conditions.

- **Headlines (Manrope):** Geometric openness and structural stability ensure numbers, pond IDs, crop cycles, and telemetry alerts are distinct.
- **Body & Controls (Inter):** Tall x-height and clear counterforms guarantee high comprehension across vernacular Indian scripts (Telugu, Hindi) alongside English text.
- **Multilingual Rules:** When rendering Indic typography (Telugu and Hindi), base line-heights automatically increase by 15-20% to prevent character clipping of diacritics and complex conjuncts while maintaining an identical vertical baseline rhythm.

## Layout & Spacing

The layout is built for native Android viewports utilizing a flexible single-column fluid layout with an underlying 4px/8px rhythm.

- **Margins & Gutters:** Base screen margins are anchored at 16px (`1rem`) to maximize screen estate while preserving comfortable thumb zones. Card internal gutters maintain a 16px rhythm for unified horizontal alignment.
- **Touch-First Accessibility:** All interactive elements maintain an absolute minimum touch zone of 48×48dp, even when visual button containers are more compact. This accommodates one-handed field usage, damp fingers, or gloved hand interaction.
- **Reflow & Dynamic Scaling:** Containers reflow vertically on standard Android phone dimensions (360dp to 420dp width). Complex sensor dashboards switch from single-column metric tiles on narrow screens to dual-column metrics only when horizontal canvas width reaches 600dp (tablets or foldable foldouts).

## Elevation & Depth

Visual hierarchy uses soft tonal distribution, boundary definition, and diffuse light reflection rather than heavy skeuomorphic drop shadows.

- **Surface Tiers:** Backgrounds sit at `#F7FAF7`. Primary content units reside on `#FFFFFF` elevated cards. Floating modally anchored elements and AI drawers incorporate an ambient, tinted atmospheric lift.
- **Shadow Profiles:**
  - *Card Base:* Zero harsh black shadows. Depth relies on a crisp outline of `1px solid #E3EBE5` paired with a daylight glow: `0px 2px 8px rgba(23, 107, 69, 0.04)`.
  - *Active / Raised State:* `0px 8px 24px rgba(23, 37, 29, 0.08)`.
  - *AI Insight Modules:* Outlined in a delicate dual-tone border (`#6546C7` at 20% opacity) coupled with `0px 4px 16px rgba(101, 70, 199, 0.08)`.
- **Low-Contrast Outlines:** Every container utilizes hairline structural definitions (`#E3EBE5`) to guarantee boundary visibility on screens operating at reduced brightness to preserve battery life.

## Shapes

The design language embodies natural ergonomics, favoring fluid, rounded surfaces that mimic organic forms without compromising technical structure.

- **Cards & Data Modules:** 16px to 20px curvature creates a welcoming, pocket-friendly interface that feels modern and soft.
- **Action Buttons & Inputs:** 12px to 16px corner radii provide substantial tactile anchoring.
- **Status Indicators, Chips, & Language Pills:** Fully pill-shaped (`9999px`) to distinguish actionable metadata tags from rectangular metric containers.

## Components

### Buttons & Tactile Actions
- **Primary Action:** Solid `#176B45` background with `#FFFFFF` text. Minimum height of 52px for thumb-reach ergonomics. Active state introduces a slight scale compression (0.98x) and a shift to `#0E4B2F`.
- **Secondary Action:** Outlined with 1.5px `#20A66A`, text in `#176B45`, transparent fill.
- **AI Action Button:** Gradient or solid `#6546C7` container with white text and an integrated spark/neural indicator icon; evokes automated smart routines.

### Cards & Telemetry Containers
- **Agricultural & Aquaculture Metric Cards:** White base, 18px corner radius, 1px `#E3EBE5` border, 16px internal padding. 
- Top-anchored with parameter labels (e.g., "Dissolved Oxygen", "Soil Moisture"), followed by large numerical readouts (`headline-lg`) and quick status chips.
- Integrated mini sparklines using `#20A66A` (optimal) or contextual warning palettes.

### Input Fields & Controls
- **Fields:** 52px height container, 12px radius, neutral background `#FFFFFF`, border `#E3EBE5`.
- **Focus State:** 2px border transition to `#20A66A` with no harsh outline glow.
- **Supporting Labels:** Prominent, persistent floating labels ensure continuous context during field logging.

### Multilingual Switcher & Indicators
- Persistent top-bar pill toggle or segmented control allowing instant switching between English, తెలుగు (Telugu), and हिन्दी (Hindi).
- Active language pill filled with `#176B45` with `#FFFFFF` text; inactive pill in muted `#718078`.
- Multi-script type pairing guarantees matched visual weight across scripts without vertical jitter.

### Chips & Status Badges
- 32px height, pill-shaped radius. 
- *Normal Condition:* `#EBF7F0` surface with `#176B45` text.
- *AI Prediction / Automation:* `#F2EFFC` surface with `#6546C7` text.
- *Attention Required:* Light amber surface with deep ochre text for weather or biological alerts.

### Checkboxes & Radios
- 24×24dp physical footprint with a 48×48dp hit-area. Checkboxes utilize an 8px radius; radios are circular. Active state fills with `#176B45` displaying a crisp white vector mark.