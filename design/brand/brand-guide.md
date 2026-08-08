# SkyStore brand guide

SkyStore is an original Nordic merchant-ledger identity: forged iron contains the application shell, while warm parchment carries information-dense working surfaces. The visual language suggests a carefully kept trade book rather than a game HUD.

## Core mark

`emblem.svg` is the primary merchant seal. Its balanced scales stand for both sides of a completed trade; its central carved diamond stands for a ledger entry and reliable weighting. The geometry is original SkyStore artwork and deliberately avoids Skyrim, Bethesda, Imperial, Stormcloak, dragon, or SkyUI iconography.

`wordmark.svg` pairs that seal with the SkyStore name and the optional “MERCHANT LEDGER” descriptor. Use the wordmark on splash, login, marketing, and spacious application headers. Use the emblem alone for compact navigation, browser icons, avatars, and app badges.

## Palette

| Token | Hex | Intended use |
| --- | --- | --- |
| Iron | `#15181D` | Primary application shell, dark mark background |
| Slate | `#252B33` | Raised navigation, panels, dark data surfaces |
| Parchment | `#D8C7A1` | Main work surface, primary light text |
| Brass | `#B78A45` | Borders, controls, emphasis, mark detail |
| Oxblood | `#7A2E2E` | Destructive actions, warnings, rejected states |
| Moss | `#647A55` | Success, confirmed, healthy stock states |

Use brass sparingly: it is a hierarchy and action signal, not a general body-text color. The decorative `knotwork-pattern.svg` should remain low-opacity and never sit behind dense text or data.

## Typography

- Display/headings: `Cinzel`, falling back to Georgia serif.
- Interface, tables, forms: `Inter`, falling back to system sans-serif.
- Financial and stock values: enable tabular numerals (`font-variant-numeric: tabular-nums`).
- Use sentence case for controls. Reserve all caps for short descriptors and micro-labels with generous letter spacing.

## Layout and component character

- Use a forged-iron outer shell with parchment pages or cards for working content.
- Give cards thin brass rules, modest corner radii (4–8px), and calm shadowing; avoid glossy fantasy ornament.
- Use the seal as a 24–32px navigation icon and 64–96px hero/login mark. Preserve at least one-quarter of the seal diameter as clear space.
- Pair status text with its color. Never communicate approved, rejected, pending, or low-confidence states by color alone.

## Accessibility

- Keep body copy at a contrast ratio of at least 4.5:1. The recommended default is Iron text on Parchment, or Parchment text on Iron/Slate.
- Brass on Parchment may not meet small-text contrast requirements; use it for rules, icons, large type, or pair it with a darker text treatment.
- Visible focus outlines should use Parchment on dark backgrounds and Iron on parchment backgrounds, with a 2px minimum thickness.
- The SVG files include accessible titles and descriptions. When the adjacent text already names the mark, use empty alternative text to avoid repeating it to screen-reader users.
- Respect `prefers-reduced-motion`; decorative knotwork should not animate by default.

## Do not

- Do not recolor the full mark with status colors.
- Do not stretch, outline, bevel, or add drop shadows to the mark.
- Do not use copyrighted Skyrim, Bethesda, or SkyUI insignia, textures, screenshots, or type treatments as branding.
