---
name: Pantry
description: Everyday food inventory and shopping workspace
colors:
  primary: '#344c5b'
  primary-hover: '#213846'
  shell: '#eee9e0'
  shell-active: '#fffefa'
  ground: '#f6f3ed'
  surface: '#fffefa'
  active: '#ece3d8'
  text: '#272d31'
  muted: '#5e6264'
  border: '#e2ddd4'
  control: '#c9c2b7'
  warning: '#865317'
  danger: '#9c3833'
typography:
  heading:
    fontFamily: 'IBM Plex Sans, Arial, sans-serif'
    fontSize: '30px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'IBM Plex Sans, Arial, sans-serif'
    fontSize: '14px'
    fontWeight: 400
  food-title:
    fontFamily: 'IBM Plex Sans, Arial, sans-serif'
    fontSize: '16px'
    fontWeight: 600
    lineHeight: 1.35
rounded:
  control: '6px'
  panel: '8px'
  card: '12px'
spacing:
  compact: '8px'
  normal: '16px'
  section: '24px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    padding: '9px 14px'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '9px 14px'
---

# Design System: Pantry

## Overview

**Creative North Star: "A place for everyday food"**

A practical workspace with warm surfaces, warm neutral navigation and clearly aligned food information. The system serves repeat tasks: checking what remains, adding a purchase and preparing a shopping list.

The source of truth is the final workspace rules in `styles.css` and the components in `src/components`. Food illustrations identify objects; they do not compete with quantities or controls.

**Key Characteristics:**

- Persistent navigation and compact stock filters.
- Warm neutral work surfaces and restrained state colors.
- Consistent labeled actions across records and editors.

## Colors

Primary ink blue marks actions and selected filters. The warm navigation surface separates navigation from work. Off-white records sit on cream ground. Warning and danger colors carry stock or destructive-action meaning.

**The State Rule.** Use color to reinforce a text label; never make color the only status cue.

## Typography

IBM Plex Sans is self-hosted and shared by headings, labels and quantities. Page headings use the heading token, reducing to 26px on phones. Food titles are 16px; secondary metadata is 12–13px. Quantities use 24px on desktop and 22px on phones. Data tables use tabular numerals.

**The One Voice Rule.** Keep the same readable family throughout the working interface.

## Layout

Navigation runs across the top at every width. The desktop workspace aligns food identity, storage, quantity and actions in compact rows. At 850px and below, food records stack their information; at 600px the workspace uses 16px side padding. Desktop records align identity, location, quantity and status. List stays left of Manage food.

Editors maintain a header, section navigation, scrollable form body and reachable save footer. The Manage editor is a right-side panel on desktop and fills the phone viewport. Search and native select controls remain usable without hover.

## Elevation & Depth

Work surfaces use borders and tonal separation. Shadows are reserved for existing overlays and menus, not ordinary food records. Focus uses a visible two-pixel outline with three-pixel offset; navigation uses the same dark outline.

## Shapes

Controls use the control radius, shopping rows use the panel radius, and food cards use the card radius. Borders remain thin. Avoid decorative outlines, gradients and glass effects.

## Components

### Buttons

Primary buttons use ink blue and white text. Secondary buttons use white surfaces and visible borders. Touch targets are at least 44px tall. Hover changes the surface or border; disabled controls use muted colors. Preserve accessible names when an icon accompanies a label.

### Stock filters

Compact buttons group stock states. Selection changes both `aria-pressed` and the background. Counts remain beside their labels.

### Food records

Show the food illustration, name, amount, storage and stock status together. Keep List on the left and Manage food on the right. Multi-batch details expand within the record.

### Fields

Use native inputs and selects, visible labels, clear focus and recoverable errors. Do not clear drafts on failed saves. Exact quantities and rough levels remain distinct.

### Navigation and editors

Navigation uses `aria-current`; editor sections use `aria-pressed`. The same section controls remain available across stock, restock and details. Destructive actions have a named confirmation.

## Do's and Don'ts

- **Do** preserve food illustrations and readable amounts.
- **Do** distinguish a purchase amount from remaining stock.
- **Do** keep optional shopping suggestions separate from chosen items.
- **Don't** add decorative motion or marketing-page hero layouts to task screens.
- **Don't** replace labeled actions with ambiguous icons.
- **Don't** return to the green visual direction the user rejected.
