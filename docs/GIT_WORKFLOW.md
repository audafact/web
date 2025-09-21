# Git Workflow Documentation

## Overview

This document outlines the standardized git workflow for the Audafact project, including branch protection settings, daily operations, and conflict resolution procedures.

## Branch Structure

### Protected Branches

- **`main`** - Production branch (protected)
- **`develop`** - Development integration branch (protected)

### Feature Branches

- **`feature/*`** - Feature development branches
- **`chore/*`** - Maintenance and cleanup branches
- **`bugfix/*`** - Bug fix branches

## Branch Protection Settings

### Main Branch

- ✅ Require a pull request before merging
- ✅ Require linear history
- ✅ Require branches to be up to date before merging
- ✅ Require signed commits (optional)

### Develop Branch

- ❌ Require a pull request before merging (DISABLED for direct pushes)
- ✅ Require linear history (ENABLED for clean history)
- ✅ Require branches to be up to date before merging
- ✅ Require signed commits (optional)

## Daily Workflow

### 1. Daily Sync (Recommended)

```bash
# Sync develop with latest main changes (use rebase to maintain linear history)
git checkout develop
git pull origin main --rebase
git push origin develop
```

**Note:** Use `--rebase` to maintain linear history and avoid merge commits that would be blocked by branch protection.

### 2. Feature Development

```bash
# Start new feature
git checkout develop
git checkout -b feature/feature-name
# ... work on feature ...
git add .
git commit -m "feat: add feature description"
git push origin feature/feature-name

# Merge feature into develop (direct push)
git checkout develop
git merge feature/feature-name
git push origin develop

# Clean up feature branch
git branch -d feature/feature-name
git push origin --delete feature/feature-name
```

### 3. Production Deployment

```bash
# Create PR: develop → main
# After PR approval and merge:

# 1. Update local main
git checkout main
git pull origin main

# 2. IMPORTANT: Do NOT pull main back into develop immediately
# This prevents circular git issues

# 3. Continue development on develop as normal
# The next daily sync will naturally align develop with main
```

**⚠️ Critical:** Do not run `git pull origin main` in develop immediately after merging develop → main. This creates circular references and the "recent pushes" issue. Let the next daily sync handle the alignment naturally.

## Complete Deployment Workflow

### Step-by-Step: Deploy to Production

1. **Ensure develop is ready:**
   ```bash
   git checkout develop
   git status  # Ensure clean working directory
   ```

2. **Create PR: develop → main**
   - Go to GitHub
   - Create pull request from develop to main
   - Add descriptive title and description
   - Request review if required

3. **After PR is approved and merged:**
   ```bash
   # Update local main
   git checkout main
   git pull origin main

   # Verify main has the latest changes
   git log --oneline -5
   ```

4. **Continue development normally:**
   ```bash
   # Return to develop for continued development
   git checkout develop
   # Continue with new features as usual
   # The next daily sync will align develop with main
   ```

5. **Next day's sync (this will align everything):**
   ```bash
   git checkout develop
   git pull origin main --rebase  # This will align develop with main
   git push origin develop
   ```

### Why This Prevents Circular Issues

- **One-way flow:** develop → main (via PR)
- **No immediate back-sync:** Avoids pulling main into develop right after merge
- **Natural alignment:** Next daily sync handles the alignment cleanly
- **Clean history:** Rebase maintains linear history without merge commits

## Conflict Resolution

### When Develop and Main Diverge

If you encounter conflicts when syncing develop with main:

#### Option 1: Rebase (Recommended for Linear History)

```bash
git checkout develop
git pull origin main --rebase
# Resolve any conflicts
git add .
git rebase --continue
git push origin develop
```

#### Option 2: Merge (Creates Merge Commit)

```bash
git checkout develop
git pull origin main --no-rebase
# Resolve any conflicts
git add .
git commit -m "Merge main into develop"
git push origin develop
```

### Resolving Merge Conflicts

1. **Identify conflicted files:**

   ```bash
   git status
   ```

2. **Edit conflicted files:**

   - Look for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
   - Choose which changes to keep
   - Remove conflict markers

3. **Stage resolved files:**

   ```bash
   git add <resolved-file>
   ```

4. **Complete the merge/rebase:**
   ```bash
   git commit -m "Resolve merge conflicts"
   # or for rebase:
   git rebase --continue
   ```

## Emergency Procedures

### When Branch Protection Blocks Operations

#### Temporary Disable Protection

1. Go to GitHub → Repository Settings → Branches
2. Edit the branch protection rule
3. Temporarily disable problematic rules:
   - "Require linear history" (if merge commits are needed)
   - "Restrict pushes that create files" (for force pushes)

#### Force Push (Use with Caution)

```bash
git push origin branch-name --force-with-lease
```

**Note:** `--force-with-lease` is safer than `--force` as it fails if someone else has pushed changes.

### Branch History Alignment

If develop and main histories diverge significantly:

1. **Create alignment branch:**

   ```bash
   git checkout main
   git checkout -b sync-develop-alignment
   git push origin sync-develop-alignment
   ```

2. **Create PR:** `sync-develop-alignment` → `develop`

3. **After merge, update main:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

## Best Practices

### Commit Messages

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Be descriptive and concise
- Reference issues when applicable

### Branch Naming

- `feature/description` - New features
- `chore/description` - Maintenance tasks
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical production fixes

### Code Review

- All changes to `main` require PR review
- Feature branches should be reviewed before merging to `develop`
- Use descriptive PR titles and descriptions

### Cleanup

- Delete feature branches after merging
- Keep repository clean with regular cleanup
- Remove stale remote tracking branches

## Troubleshooting

### Common Issues

#### "Divergent branches" error

```bash
git config pull.rebase false  # Use merge strategy
git pull origin branch-name
```

#### "Protected branch update failed"

- Check branch protection settings
- Ensure you have required permissions
- Temporarily disable problematic protection rules if needed

#### Force push rejected

- Verify branch protection allows force pushes
- Use `--force-with-lease` instead of `--force`
- Coordinate with team if shared branch

#### "Recent pushes" message persists

- This often occurs after merging develop → main via PR
- Use rebase to align histories: `git pull origin main --rebase`
- May require force push: `git push origin develop --force-with-lease`

### Recovery Commands

#### Reset to remote state

```bash
git fetch origin
git reset --hard origin/branch-name
```

#### Abort merge/rebase

```bash
git merge --abort
git rebase --abort
```

#### Clean working directory

```bash
git clean -fd  # Remove untracked files
git reset --hard HEAD  # Reset tracked files
```

## Team Guidelines

### Before Starting Work

1. Always start from `develop`
2. Pull latest changes: `git pull origin main`
3. Create feature branch from updated `develop`

### Before Committing

1. Run tests: `npm test`
2. Check linting: `npm run lint`
3. Stage only relevant changes: `git add <specific-files>`

### Before Pushing

1. Ensure clean working directory
2. Push feature branch first
3. Merge to develop after testing

### Weekly Maintenance

1. Sync all branches with main
2. Clean up merged feature branches
3. Review and update branch protection rules if needed

---

**Last Updated:** January 2025  
**Maintainer:** Development Team  
**Review Cycle:** Monthly
