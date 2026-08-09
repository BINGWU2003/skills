# Playful Developer-Tool Style Guide

## Design DNA

Aim for **editorial developer-tool functionalism**: a serious working interface with enough warmth, wit, and graphic confidence to feel authored.

The style draws from three complementary qualities:

- Precise: clear hierarchy, technical credibility, compact controls, dependable states.
- Playful: warm tone, approachable writing, occasional illustration or unexpected brand detail.
- Editorial: strong headings, deliberate rhythm, visible information structure, confident use of rules and accent blocks.

Treat Sentry, PostHog, and Awesome Claude as lineage, not templates. Do not copy their logos, mascots, proprietary illustrations, exact palettes, or page compositions.

## Hierarchy and layout

- Start with the user's primary task and the information required to complete it.
- Default to medium density. Preserve context, but remove monitoring-console noise that is not required for the task.
- Use a stable application frame for tools: compact navigation, clear page header, contextual controls, and a dominant work surface.
- Use a strong editorial header for marketing, directories, and documentation, followed by clear sections or indexed rows.
- Prefer lists, tables, split panes, grouped rows, and inline metadata when objects belong to one collection.
- Use cards only for genuinely independent objects. Avoid cards inside cards.
- Create separation in this order: spacing and alignment, typography, dividers, subtle surface tint, border, then shadow.
- Keep page width purposeful. Data-heavy tools may use the viewport; long-form text should remain comfortably readable.

## Density and spacing

- Use a compact base spacing rhythm, then create emphasis with larger jumps between major regions.
- Keep control rows and navigation compact enough for real work.
- Give headings room without turning every product screen into a landing-page hero.
- Reveal secondary detail progressively through drawers, disclosure rows, hover detail, or contextual panels.
- Do not remove useful context merely to create empty space.

## Color

Use semantic roles rather than brand-specific values:

- `canvas`: warm off-white or quiet cool neutral.
- `surface`: close to the canvas, separated subtly.
- `surface-muted`: reserved for grouped secondary regions.
- `ink`: near-black or deep blue-black.
- `ink-muted`: readable neutral text, not low-contrast gray.
- `line`: visible enough to structure dense information without becoming a grid cage.
- `accent`: one primary accent family, commonly warm orange, violet, blue, or another brand-derived hue.
- `state-*`: accessible success, warning, danger, and information colors with text/icon support.

Starter palette for an unbranded light interface; adapt it to the product:

| Token | Suggested value | Role |
| --- | --- | --- |
| canvas | `#F7F5F0` | Warm working canvas |
| surface | `#FFFDF8` | Primary surface |
| surface-muted | `#EEEAE2` | Grouped secondary area |
| ink | `#202124` | Primary text and strong rules |
| ink-muted | `#65676D` | Secondary text |
| line | `#D5D0C7` | Dividers and control borders |
| accent | `#E05D2F` | Warm primary accent |
| accent-secondary | `#6552D9` | Rare technical or editorial counterpoint |

Use the secondary accent sparingly or omit it. A product with an existing palette should keep its brand colors and translate only the role system.

Avoid decorative gradients, glass surfaces, neon bloom, and large low-contrast color washes unless the supplied brand already requires them.

## Typography

- Use a highly readable sans serif for product UI. Use an expressive display face only for major editorial or marketing headings.
- Use monospace for code, identifiers, timestamps, shortcuts, or small technical labels—not for all body text.
- Keep product body text around 14–16 px and metadata around 12–13 px when accessibility and platform conventions allow.
- Build contrast through weight, size, case, spacing, and color; do not rely on size alone.
- Keep button labels and navigation direct and compact.
- Avoid oversized hero typography inside operational screens.

## Shape, border, and elevation

- Default control and panel radii to roughly 4–8 px.
- Reserve full pills for tags, filters, statuses, and compact toggles whose shape communicates purpose.
- Use 1 px borders for structure; use 2 px rules only for deliberate emphasis or a lightly neo-brutalist moment.
- Keep shadows rare and short. Prefer borders, surface shifts, or an intentional small offset shadow for one branded focal element.
- Do not put every section inside a rounded rectangle.

## Components

### Navigation

- Keep sidebars compact and visually subordinate to the work surface.
- Make active state unmistakable through weight, accent, a marker, or surface—not several effects at once.
- Group destinations by user intent rather than feature inventory.

### Lists and tables

- Prefer a single grouped surface with row dividers over a grid of individual cards.
- Align repeated metadata and actions consistently.
- Keep essential actions visible; move rare actions into contextual menus.
- Support sorting, filtering, selection, and empty states only when the workflow needs them.

### Controls

- Use compact controls with visible labels and predictable focus states.
- Avoid turning every action into a high-emphasis button.
- Use accent fill for the primary action; use border, text, or subtle surface treatments for supporting actions.

### Brand character

- Add one memorable device per major view: a concise illustration, asymmetric accent slab, witty microcopy, bold rule, mascot cameo, or distinctive status treatment.
- Keep illustrations real and intentional. Do not fake assets with emoji, ASCII art, or decorative placeholder shapes.
- Humor must not obscure system state, errors, or task completion.

## Motion

- Favor fast 120–200 ms transitions for hover, selection, menus, and disclosure.
- Animate state changes and spatial relationships, not decoration for its own sake.
- Respect reduced-motion preferences.

## Responsive behavior

- Preserve the task hierarchy at every breakpoint.
- Collapse secondary navigation into a drawer or switcher; do not remove essential context.
- Let dense tables scroll, reflow into prioritized rows, or open a detail view rather than stacking every cell blindly.
- Keep primary actions reachable and maintain readable tap targets.
- Reconsider split panes and persistent inspectors on smaller screens.

## Tailwind CSS implementation

- Keep semantic values in CSS custom properties or the project's established token source.
- In Tailwind CSS v4, expose semantic tokens through `@theme` or `@theme inline` when compatible with the existing setup.
- In Tailwind CSS v3, map the same semantic tokens through `theme.extend`.
- Prefer classes such as `bg-canvas`, `text-ink`, `border-line`, and `rounded-ui` over repeated raw values.
- Use arbitrary utilities only for intentional exceptions; repeated exceptions indicate a missing token.
- Extract repeated class groups into a component or variant utility when they express a reusable UI primitive.
- Preserve the current Tailwind version, build pipeline, component library, and class-merging conventions.
- When using shadcn/ui, retune tokens, reduce blanket card usage, tighten product density, and preserve accessible primitive behavior.

## Anti-patterns

Reject or revise these patterns unless a supplied product system explicitly requires them:

- Giant gradient headline followed by three interchangeable feature cards.
- Glassmorphism, blurred neon blobs, or deep soft shadows.
- Large 16–24 px radii on every surface.
- Cards nested inside other cards.
- Pills used for ordinary buttons, navigation, and containers.
- Excessive badges, metrics, tabs, or filters added only to make a screen look feature-rich.
- Empty marketing-scale spacing inside a working product interface.
- Muted gray text that fails contrast or hides hierarchy.
- Decorative accent color applied to every heading and icon.
- Responsive layouts that simply stack the entire desktop UI into one long column.
- Tailwind class strings dominated by arbitrary hex colors and one-off pixel values.
- Default component-library styling presented as a finished visual identity.

## Audit rubric

Score each area as strong, mixed, or weak:

1. Primary-task clarity
2. Information hierarchy
3. Medium-density balance
4. Grouping without card overuse
5. Typography and metadata rhythm
6. Restrained color and visible states
7. Professional character with one playful layer
8. Responsive preservation of priority
9. Accessibility and interaction states
10. Tokenized, maintainable Tailwind implementation when code is present
