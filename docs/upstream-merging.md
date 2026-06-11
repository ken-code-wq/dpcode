# Merging Upstream Changes

This repo is a fork-of-a-fork:

```
T3Code (t3tools/t3code) ──> DP Code (Emanuele-web04/dpcode) ──> your fork (local)
```

You want features from both DP Code (upstream fixes/releases) and T3Code (original
features DP Code may not have merged). This doc covers both.

## Remotes

### Already configured

```
origin  https://github.com/Emanuele-web04/dpcode (fetch)
```

DP Code is where you pull upstream releases from.

### Add T3Code

T3Code is the original. You cannot merge it wholesale (histories diverged), but
you can cherry-pick individual features:

```bash
git remote add t3code https://github.com/t3tools/t3code
git fetch t3code
```

### Optional: personal backup fork

```bash
git remote add fork https://github.com/YOUR_USER/dpcode
git push fork my-changes
```

## Branch Strategy

- **`main`** — tracks DP Code's main branch cleanly (no local changes)
- **`my-changes`** — carries all your local customizations on top of main
- **`t3code-features`** (optional) — T3Code cherry-picks you want, kept separate
  from your own changes for cleaner rebasing

```
main  ───── DP Code ──> new release ──> ...
            └── rebase ──> my-changes (your local customizations)
            └── merge ──> t3code-features (T3Code cherry-picks)
```

## DP Code Updates (periodic)

```bash
# Pull latest DP Code
git checkout main
git pull origin main

# Replay your changes on top
git checkout my-changes
git rebase main
```

If conflicts:

1. Edit the conflicted file
2. `git add <file>`
3. `git rebase --continue`
4. Run `bun typecheck && bun lint && bun fmt`

## T3Code Features (surgical)

Since DP Code and T3Code have diverged, you can't merge T3Code directly. Use one
of these approaches instead.

### Approach A: cherry-pick specific commits

Find the T3Code commit(s) that implement the feature you want:

```bash
git log t3code/main --oneline --grep="feature name" -10
git log t3code/main --oneline -- <relevant-file-path> -10
```

Then cherry-pick onto your branch:

```bash
git checkout my-changes
git cherry-pick <commit-hash>
```

Fix conflicts as they arise, then `git cherry-pick --continue`.

### Approach B: surgical file replacement

If the feature lives in a small set of files, grab just those files:

```bash
# Check what changed in T3Code for a specific file
git log t3code/main --oneline -- apps/server/src/some-file.ts

# Apply that file's latest T3Code version
git checkout t3code/main -- apps/server/src/some-file.ts
```

This overwrites the file entirely. Adapt it to work with DP Code's surrounding
code.

### Approach C: manual port

Read the T3Code diff for a feature and apply it by hand. Most reliable when the
two forks have diverged heavily:

```bash
# View the full diff of a T3Code commit
git show t3code/<commit-hash>

# Or compare T3Code main against DP Code for a file
git diff t3code/main origin/main -- apps/server/src/some-file.ts
```

## T3Code + DP Code + Local Changes All Together

When you want to incorporate a T3Code feature AND stay current with DP Code:

```bash
# 1. Bring main to latest DP Code
git checkout main
git pull origin main

# 2. Rebase your changes
git checkout my-changes
git rebase main

# 3. Cherry-pick the T3Code feature
git cherry-pick <t3code-commit-hash>

# 4. Verify
bun typecheck && bun lint && bun fmt
```

The order matters: DP Code first (your foundation), then T3Code on top. This
way conflicts from DP Code changes are resolved before you introduce T3Code
diffs.

## Reference

```bash
# List all remotes
git remote -v

# See what T3Code has that DP Code doesn't (rough, may show massive diff)
git log --oneline origin/main..t3code/main | wc -l

# Search T3Code commits by keyword
git log t3code/main --oneline --all --grep="checkpoint\|diff\|favicon"

# View a T3Code commit's changes
git show t3code/<hash>

# List files changed in a T3Code commit
git diff --name-only t3code/<hash>^..t3code/<hash>
```
