# Colour contrast research and palette audit

## Standard used

This site targets WCAG 2.2 Level AA.

- Normal text must have a contrast ratio of at least **4.5:1** against its background.
- Large text must have a ratio of at least **3:1**. WCAG defines large text as at least 18pt regular or 14pt bold.
- Meaningful interface components, focus indicators, icons, and graphical objects must have at least **3:1** contrast against adjacent colours.
- Ratios are thresholds and must not be rounded up. For example, 2.99:1 does not pass 3:1.
- Decorative graphics are exempt when they do not communicate information or provide an interactive control.
- WCAG contrast uses relative luminance: `(L1 + 0.05) / (L2 + 0.05)`, where L1 is the lighter colour.

Primary references:

- [WCAG 2.2, Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- [Understanding SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C technique G17: contrast calculation and relative luminance](https://www.w3.org/WAI/WCAG22/Techniques/general/G17)
- [W3C technique G207: 3:1 contrast for meaningful icons](https://www.w3.org/WAI/WCAG22/Techniques/general/G207)

## Audit findings

The first 0684-derived palette retained the reference image's hues, but several functional pairings were too close in luminance:

| Pair | Previous ratio | Result |
| --- | ---: | --- |
| Eucalyptus `#789590` on ice `#d9e8e9` | 2.56:1 | Fail for text |
| Slate `#47749a` on ice `#d9e8e9` | 3.94:1 | Fail for normal text |
| Slate `#47749a` on sage `#91a8a1` | 1.97:1 | Fail |
| Sage `#91a8a1` on denim `#28517d` | 3.25:1 | Fail for small text |
| Navy `#172a46` on ice `#d9e8e9` | 11.45:1 | Pass AAA |
| Ice `#d9e8e9` on denim `#28517d` | 6.50:1 | Pass AA |

## Revised accessible palette

The palette keeps the ink, denim, eucalyptus, sage, duck-egg, and ice character of image 0684 while increasing luminance separation.

| Token | Colour | Intended use |
| --- | --- | --- |
| Navy | `#172a46` | Primary text, hero and browser canvas |
| Charcoal | `#152238` | Deep supporting shade |
| Denim | `#28517d` | Dark accent surfaces and text on pale surfaces |
| Slate | `#345f83` | Secondary body text on ice |
| Eucalyptus | `#496a64` | Small decorative accent only |
| Sage | `#a7bdb6` | Small decorative accent only |
| Duck egg | `#b8cfd2` | About section and light blue supporting surface |
| Ice | `#d9e8e9` | Lightest blue surface and text on dark colours |

Key implemented pairings:

| Pair | Ratio | Result |
| --- | ---: | --- |
| Navy on ice | 11.45:1 | Pass AAA |
| Navy on duck egg | 8.86:1 | Pass AAA |
| Denim on ice | 6.50:1 | Pass AA |
| Slate on ice | 5.36:1 | Pass AA |
| Ice on slate | 5.36:1 | Pass AA |
| Ice on denim | 6.50:1 | Pass AA |
| Sage on navy | 7.28:1 | Pass AAA |

Body copy and small labels use pairings of at least 4.5:1. Green hues are restricted to small decorative accents; they are not used as large section surfaces or functional text colours. Decorative low-contrast geometry remains permissible because it conveys no information. Keyboard focus rings use denim on pale surfaces and ice on dark surfaces, comfortably exceeding the 3:1 non-text requirement.
