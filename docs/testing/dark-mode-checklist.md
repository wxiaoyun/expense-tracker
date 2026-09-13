# Dark Mode iPhone Simulator Checklist

Device: iPhone 17 Pro, iOS 26.5

## Stable surfaces

| Surface                | Light | Dark | Transition while open                                              | Evidence                                                    |
| ---------------------- | ----- | ---- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Expenses tab           | Pass  | Pass | Pass. Search and Month filter stayed selected.                     | `light-expenses.png`, `dark-expenses.png`                   |
| Templates tab          | Pass  | Pass | Pass. Search and empty state stayed selected.                      | `light-templates.png`, `dark-templates.png`                 |
| Summary tab            | Pass  | Pass | Pass. Month range and empty cards stayed selected.                 | `light-summary.png`, `dark-summary.png`                     |
| Settings tab           | Pass  | Pass | Pass. System selection and scroll position stayed stable.          | `light-settings.png`, `dark-settings.png`                   |
| Transaction form sheet | Pass  | Pass | Pass. Sheet, amount, description, focus, and keyboard stayed open. | `light-transaction-sheet.png`, `dark-transaction-sheet.png` |
| Template form sheet    | Pass  | Pass | Pass. Schedule controls and date picker stayed open.               | `light-template-sheet.png`, `dark-template-sheet.png`       |
| Migration screen       | Pass  | Pass | Pass. Detected counts stayed stable.                               | `light-migration.png`, `dark-migration.png`                 |

## Transient and state coverage

| Surface or state                                                                   | Result | Notes                                                                                                                                |
| ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Expense loading, populated, filtered, and empty states                             | Pass   | Populated, filtered, and empty states checked in Simulator. Loading and error branches use semantic colors and passed Jest coverage. |
| Expense transaction menu and delete confirmation                                   | Pass   | Dark native menu and confirmation checked. Deletion was canceled.                                                                    |
| Template loading, populated, filtered, and empty states                            | Pass   | Populated, filtered, and empty states checked in Simulator. Loading and error branches use semantic colors and passed Jest coverage. |
| Template actions and confirmation alerts                                           | Pass   | Dark native action menu and delete confirmation checked. Deletion was canceled.                                                      |
| Transaction inputs, category picker, date picker, switch, keyboard, and validation | Pass   | Controls, dark validation banner, and live keyboard transition checked.                                                              |
| Template inputs, category picker, date picker, switches, keyboard, and validation  | Pass   | Scheduled controls and dark native calendar checked. Validation branches passed Jest coverage.                                       |
| Summary populated, empty, and error states                                         | Pass   | Populated and empty ranges checked in Simulator. Loading and error branches use semantic colors and passed Jest coverage.            |
| Settings pickers, switch, alerts, document picker, share flow, and restore overlay | Pass   | Native picker, share sheet, and alerts checked. Restore overlay uses the verified semantic overlay and is covered by runtime tests.  |
| System appearance follows live simulator changes                                   | Pass   | Simulator Light to Dark and Dark to Light changes updated the open app immediately.                                                  |
| Current tab, form values, sheet state, and scrolling survive appearance changes    | Pass   | Tabs, filters, sheets, entered values, focus, keyboard, and visible position remained stable.                                        |
| Cold launch has no incorrect light frame                                           | Pass   | Rebuilt app launched under System Dark with a dark first app frame.                                                                  |
| WCAG AA semantic color pairs                                                       | Pass   | Normal text, placeholder, primary fill, destructive banner, and chart colors were checked at 4.5:1 or higher where text is present.  |

Screenshots are stored under `.artifacts/dark-mode/` and excluded from Git.
