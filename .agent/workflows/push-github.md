---
description: push project to github with branch differences
---
Whenever the user asks to push to github, follow these steps exactly to maintain the difference between main and release logic:

1. Commit any pending work and push the current state to the `main` branch.
2. Checkout the `TVBS_AICG_release` branch.
3. Merge `main` into `TVBS_AICG_release`.
4. Use the `replace_file_content` tool on `App.tsx` to explicitly restrict the `formats` array in the `renderSetupScreen` function to only contain the following 3 options: `profile`, `double`, `triple`. Remove any other options like `pullout`, `injury`, or `social`.
5. Commit these specific format restrictions into the `TVBS_AICG_release` branch.
6. Push `TVBS_AICG_release` to origin.
7. Checkout the `main` branch again so the user remains on the full-featured branch.
