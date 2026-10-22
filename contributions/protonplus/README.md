# ProtonPlus CLI contribution for issue #1313

Upstream: https://github.com/Vysp3r/ProtonPlus/issues/1313

## Changes prepared

- Output stable provider/runner ID, release tag and display title for each managed installation when running `protonplus list <launcher_id>`.
- Omit unmanaged directories and entries without an ID or tag.
- Add fixture-based CLI regression coverage, including the no-managed-releases case.

## Important

This is a **review/staging branch**, not an upstream ProtonPlus branch. The authenticated GitHub account does not have write access to `Vysp3r/ProtonPlus`, and currently has no fork of it. The patch is staged here so it can be reviewed without altering this repository's `main` branch.

## After reviewing

1. Fork https://github.com/Vysp3r/ProtonPlus to your account.
2. Check out the fork and create a branch from upstream `main`.
3. Download `0001-cli-list-runner-id-release-tag.patch` from this directory.
4. In the ProtonPlus checkout, run:

```sh
git apply --check 0001-cli-list-runner-id-release-tag.patch
git apply 0001-cli-list-runner-id-release-tag.patch
meson setup build   # only if not configured
meson compile -C build
meson test -C build --print-errorlogs
git add src/cli/cli.vala tests/cli_test.vala
git commit -m 'cli: include runner IDs and tags in installed listing'
git push -u origin your-branch-name
```

5. Open a pull request to `Vysp3r/ProtonPlus` and reference `Fixes #1313`.

## Validation status

Patch syntax and whitespace were checked in a matching temporary Git source fixture. ProtonPlus compilation, GLib tests and live CLI behavior are **not verified** here because the local environment does not have Vala/Meson or a full upstream checkout.
