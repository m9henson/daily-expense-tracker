# Daily Spend

A phone-first personal expense tracker designed for GitHub Pages.

## Included

- Quick expense entry
- Categories: Eating Out, Groceries, Gas, Golf / Fun, Household, Kids, Goodwill, Other
- Today and monthly totals
- Category budgets and remaining monthly budget
- Expense history with search/filter
- Edit and delete entries
- CSV export
- Full JSON backup/restore
- Installable PWA / home-screen shortcut
- Works offline after first load
- Private local browser storage by default

## Publish on GitHub Pages

1. Create a new GitHub repository, for example `daily-expense-tracker`.
2. Upload every file/folder in this project to the repository root.
3. Open the repository **Settings**.
4. Open **Pages** under Code and automation.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and `/(root)`, then Save.
7. GitHub will show the public Pages URL after deployment.

## Important data note

This version stores expenses in the browser's localStorage. That means:

- Entries stay on the device/browser where you entered them.
- Clearing site data/browser storage can remove them.
- Use **Settings → Backup** periodically.
- Use **Restore** to reload a backup.

A Firebase/Firestore sync layer can be added later if you want the same expenses automatically available on multiple devices.
