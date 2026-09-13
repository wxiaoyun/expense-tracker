# Dark Mode Design

## Goal

Restore complete iOS dark mode support. Every production page, tab, sheet, menu, alert, and relevant UI state must remain readable and usable in Light and Dark appearances. Changing appearance must preserve navigation and transient UI state without visible flashing, remounting, or jank.

## Appearance behavior

Settings exposes an **Appearance** picker with three choices:

- **System** follows the current iOS appearance and responds to live system changes.
- **Light** forces Light appearance for the app.
- **Dark** forces Dark appearance for the app.

The existing `pref.theme` setting remains the source of truth. Valid preferences saved by earlier versions are honored. Missing or invalid values use `System`. Resetting preferences selects and immediately applies `System`.

Preference changes are persisted before they are applied. A failed save keeps the previous appearance and shows the existing preference failure alert. Restoring a database reloads and applies the restored appearance preference.

## Startup behavior

The native app configuration allows automatic appearance again. A single neutral brand launch screen is used for Light and Dark appearances because SQLite preferences are unavailable before JavaScript starts.

App content remains behind the launch screen until preferences load and the effective appearance is applied. The first visible app frame therefore uses the correct saved appearance without a light flash.

## Theme architecture

The existing theme hook becomes the single semantic color source. No new theme framework or duplicate theme state is introduced.

The palette covers at least:

- Primary and secondary text
- Page and grouped backgrounds
- Raised surfaces and inputs
- Separators and borders
- Muted and selected fills
- Primary tint
- Destructive foreground and background
- Overlays
- Chart axes, grid lines, labels, and tracks

The effective color scheme comes from React Native after the selected preference is applied through `Appearance`. React Navigation receives the matching navigation theme. Status bar content, native tabs, form sheets, native controls, alerts, menus, pickers, and toast presentation follow the same effective appearance.

Light appearance preserves the current visual design. Dark appearance uses iOS-style semantic neutrals. Existing brand, category, income, expense, warning, and destructive colors remain when they satisfy contrast requirements. Only colors that fail contrast are adjusted.

## Surface migration

Hardcoded neutral colors are replaced with semantic palette values across all production-reachable surfaces:

- Expenses tab, filters, transaction list, rows, menus, empty, loading, and error states
- Templates tab, filters, template list, rows, actions, empty, loading, and error states
- Summary tab, metric cards, empty cards, category breakdown, cash-flow trend, monthly bars, and category donut
- Settings tab, preferences, backup controls, restore overlay, native controls, document picker, and share flow
- Transaction form sheet, including inputs, category picker, date picker, switches, chips, and validation errors
- Template form sheet, including inputs, category picker, date picker, switches, chips, and validation errors
- Migration screen and its glass treatment
- Root navigation, native tabs, status bar, alerts, confirmations, menus, and toast notifications

Appearance changes must not replace route keys or remount the application tree. Current tab, navigation stack, open sheet, form values, scroll position, and overlay state remain intact.

## Accessibility

Both appearances must meet WCAG AA contrast for normal text and controls. Dynamic Type remains supported. Increased Contrast must not make text, controls, borders, or selected states indistinguishable.

## Automated verification

Add focused tests for:

- Resolving Light and Dark semantic palette values
- Resolving `System` from the current iOS appearance
- Loading valid legacy preferences and rejecting invalid values
- Applying, resetting, and restoring appearance preferences
- Preserving the previous preference after a persistence failure

Run the complete Jest suite and Expo lint.

## iPhone Simulator verification

Use one current iPhone Simulator. Android, web, and iPad verification are outside this request.

Verify every listed production surface in forced Light and forced Dark appearances. Also verify `System` while changing the simulator between Light and Dark. During each transition, confirm that navigation position, open sheets, form values, scrolling, and overlays remain stable and that no incorrect-color frame or obvious animation hitch appears.

Exercise populated, empty, loading, error, validation, confirmation, picker, menu, keyboard, document, share, migration, and restore states where applicable. Record each result in a coverage checklist.

Save paired Light and Dark screenshots for stable pages and sheets in a git-ignored artifact directory. Record transient native surfaces such as alerts and menus in the checklist when paired capture is impractical.

## Explicit exclusions

- No unrelated visual redesign
- No custom appearance transition animation
- No new theme framework
- No Android, web, or iPad dark mode verification
- No developer-only screen coverage
- No domain glossary entry because Appearance is general UI terminology
- No ADR because the selected architecture is conventional and inexpensive to reverse
