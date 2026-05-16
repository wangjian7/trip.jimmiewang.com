---
name: Voyage & Vista
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#5e604d'
  on-secondary: '#ffffff'
  secondary-container: '#e1e1c9'
  on-secondary-container: '#636451'
  tertiary: '#894d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ac6300'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e4e4cc'
  secondary-fixed-dim: '#c8c8b0'
  on-secondary-fixed: '#1b1d0e'
  on-secondary-fixed-variant: '#474836'
  tertiary-fixed: '#ffdcbf'
  tertiary-fixed-dim: '#ffb874'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6a3b00'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 20px
  gutter-mobile: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style

The design system is engineered to evoke a sense of professional wanderlust. It balances the high-utility requirements of a planning tool with the emotional warmth of global exploration. The aesthetic is **Modern/Corporate with a Tactile twist**, prioritizing clarity and organization to reduce the cognitive load of travel logistics.

The visual narrative relies on "The Explorer’s Canvas"—a layout characterized by expansive whitespace (the "horizon"), punctuated by high-energy accents. The primary objective is to make the user feel empowered and secure (Action Blue) while remaining inspired by the organic beauty of their destination (Sandy Beige and Sunset Orange).

Key stylistic pillars:
- **Clarity over Clutter:** Every element has room to breathe, reflecting the openness of travel.
- **Dynamic Energy:** Use of vibrant orange for highlights and calls-to-action to represent the excitement of discovery.
- **Grounded Reliability:** Structured grids and systematic typography ensure the user feels in control of their itinerary.

## Colors

The palette is anchored by **Action Blue**, used strictly for interactive elements, navigation, and primary brand moments. This creates a clear mental model: "If it’s blue, I can act on it."

**Sandy Beige** serves as a soft, sophisticated background alternative to harsh whites, used for secondary surfaces and card containers to add a tactile, paper-like quality. **Sunset Orange** is reserved for high-visibility accents: "New," "Trending," notifications, or critical path highlights.

Neutral tones are slightly warmed (Slate-tinted) to ensure they feel cohesive with the beige and orange accents, avoiding the sterile feel of pure grayscale.

## Typography

This design system utilizes **Inter** exclusively to leverage its exceptional legibility and systematic weight distribution. The type scale is aggressive, using significant size contrasts to establish a clear hierarchy on small screens.

- **Display & Headlines:** Use Tight letter-spacing and SemiBold/Bold weights to create impact for destination names and section headers.
- **Body Text:** Standard weight with generous line height (1.5x) to ensure long-form itineraries are readable during transit.
- **Labels:** Uppercase or slightly tracked-out labels are used for metadata like "FLIGHT NUMBER" or "PRICE PER NIGHT" to differentiate data from narrative content.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first interaction. We utilize an 8px base unit to ensure all components scale mathematically.

- **Margins:** A generous 20px side margin is maintained to keep content away from the edges, reinforcing the premium, "un-cluttered" feel.
- **Vertical Rhythm:** Elements within a card use `stack-sm`. Distinct sections within a screen (e.g., Search vs. Recommended) use `stack-lg` to provide a strong visual break.
- **Safe Areas:** Interactive elements like buttons and navigation bars must respect a 48px minimum touch target height, even when visually appearing smaller.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and **Tonal Layering**. We avoid heavy, black shadows in favor of tinted, diffused elevations that feel like natural light hitting a physical surface.

- **Level 0 (Surface):** The base background (#FCFCFA).
- **Level 1 (Cards):** Sandy Beige or White cards with a subtle 4px blur shadow (5% opacity of Neutral color). Used for list items and secondary information.
- **Level 2 (Active/Floating):** Primary action buttons or "Pinned" destination cards. These use a 12px blur shadow with 10% opacity, creating a distinct "lift" that invites a tap.
- **Backdrop Blurs:** Used for sticky navigation headers and modal overlays to maintain a sense of context and depth.

## Shapes

The shape language is defined by **pronounced, friendly radii**. As per the core requirements, the standard radius for cards and major containers is 16px (represented by `rounded-lg` in this design system).

- **Small Components:** Checkboxes and small tags use a 4px radius to maintain precision.
- **Standard Components:** Input fields and buttons use an 8px radius.
- **Containers:** Trip cards, map overlays, and itinerary blocks use the 16px (`rounded-lg`) radius to soften the interface and feel approachable.
- **Pill Shapes:** Used exclusively for status indicators (e.g., "Confirmed") and search bars to maximize the "friendly" aesthetic.

## Components

### Search & Filters
The search bar is a prominent pill-shaped element. It should feature a subtle Sandy Beige fill to distinguish it from the white background, with a persistent search icon in Action Blue.

### Destination Cards
Cards feature a high-quality imagery header with the bottom 16px corners rounded. Typography within cards should use `headline-md` for the title and `label-sm` for location data. A Sunset Orange tag should be used for pricing or ratings to draw immediate attention.

### Itinerary Timelines
A vertical 2px stroke in Action Blue connects "activity nodes." Each node is a white card with Level 1 elevation. Time indicators should use `label-md` in a neutral gray, placed to the left of the timeline stroke.

### Buttons
- **Primary:** Action Blue background, white text, 8px radius.
- **Secondary:** Sandy Beige background, Action Blue text, no shadow.
- **Ghost:** No background, Action Blue border and text, used for less frequent actions like "Cancel" or "Edit."

### Interactive Maps
Maps should use a custom "Silver" or "Light" style to match the UI. Markers use Action Blue for current selection and Sunset Orange for "Featured" points of interest. All map overlays (info bubbles) must adhere to the 16px `rounded-lg` corner rule.