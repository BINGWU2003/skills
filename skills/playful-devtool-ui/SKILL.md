---
name: playful-devtool-ui
description: "Design, restyle, implement, or audit websites and web applications in a precise but playful developer-tool visual language: medium information density, editorial hierarchy, compact controls, flat surfaces, fine borders, small radii, restrained color, and distinctive brand character. Use when the user asks for a Sentry-, PostHog-, or Awesome Claude-inspired feel; a playful developer-tool UI; a professional interface that avoids generic SaaS styling; or explicitly invokes $playful-devtool-ui. Supports marketing sites, dashboards, documentation, directories, and Tailwind CSS implementations."
---

# Playful Devtool UI

Create interfaces that feel capable, information-rich, and human. Combine precise developer-tool ergonomics with restrained editorial character; do not copy a reference brand literally.

## Load the references

- Read [references/style-guide.md](references/style-guide.md) for every design, restyle, implementation, or audit task.
- Also read [references/prompts.md](references/prompts.md) when the user wants a reusable prompt, a design-tool handoff, or a prompt for another model.

## Choose the mode

### Design

Use for a new website, dashboard, directory, documentation surface, or component.

1. Identify the surface, primary user task, content density, brand material, and technical constraints.
2. Inspect supplied screenshots, URLs, existing code, tokens, and components before choosing visual details.
3. Define the hierarchy and information architecture before styling.
4. Apply the style guide without inventing unnecessary features.
5. Make the primary journey and its visible states work.

### Restyle

Use when adapting an existing interface.

1. Preserve functionality, content, routes, and interaction behavior unless the user asks to change them.
2. Inventory the existing layout, tokens, typography, components, and responsive behavior.
3. Translate the interface through semantic tokens and shared primitives before making local exceptions.
4. Reduce generic SaaS patterns such as nested cards, excessive pills, soft shadows, gradients, and oversized empty areas.
5. Verify that the restyle improves hierarchy without reducing useful information density.

### Audit

Use when reviewing an existing interface.

1. Compare the interface against the style guide.
2. Report findings by impact: hierarchy and task flow, density and grouping, visual language, brand character, responsive behavior, and accessibility.
3. Tie every finding to a visible element and propose a concrete correction.
4. Mark behavior, states, accessibility, or implementation quality as not assessed when the supplied evidence cannot verify them; do not infer hidden problems.
5. Do not implement changes unless the user asks for implementation.

## Set the brief

When the user omits a non-critical choice, use these defaults:

- Density: medium; show enough context for real work without reproducing a monitoring console's maximum density.
- Tone: 45% warm and playful, 35% precise and professional, 20% editorial and lightly neo-brutalist.
- Surface: warm or neutral canvas, flat grouping, fine dividers, compact typography, and one restrained accent family.
- Brand character: one intentional playful moment per major view, never decoration on every component.
- Adaptation: keep the design language consistent across marketing, dashboard, documentation, and directory surfaces while changing the information architecture to fit the task.

Do not ask the user to choose design jargon when provided references or existing code already answer the question.

## Implement with Tailwind CSS

Keep the design rules framework-independent, but default code implementation to Tailwind CSS.

1. Reuse the project's current Tailwind version and configuration. Never upgrade Tailwind merely to use this skill.
2. For a new compatible project, prefer Tailwind CSS v4.
3. Define semantic design tokens for canvas, surface, ink, muted ink, line, accent, state, radius, and spacing. Map utilities to those tokens.
4. Prefer project utilities and tokens over scattered arbitrary values. Use an arbitrary value only for a deliberate exception.
5. Reuse the project's component system. If none exists, use accessible headless primitives or small local components.
6. Use shadcn/ui when it fits the project, but restyle its defaults; do not let default large radii, card grids, or muted SaaS styling determine the product's identity.
7. Do not install packages, replace the component system, or modify framework configuration unless the task requires it.

## Verify the result

Check all of the following before handoff:

- The primary task is obvious without a marketing explanation.
- Information is grouped mainly through spacing, alignment, type, and dividers rather than nested cards.
- Text, controls, tables, lists, and states remain readable at realistic density.
- Accent color communicates hierarchy or state instead of decorating every section.
- At least one brand detail adds personality, but the interface still feels professional.
- Empty, loading, error, selected, hover, focus, and disabled states are handled when relevant.
- Responsive layouts preserve priority; they do not merely stack every desktop region vertically.
- Keyboard focus, contrast, labels, and reduced motion are considered.
- Tailwind classes reuse semantic tokens and do not devolve into repeated arbitrary values.
- The result does not resemble a generic gradient-and-rounded-card SaaS template.

When a visual reference is available, compare the rendered result against it at the same viewport and correct visible mismatches before claiming fidelity.
