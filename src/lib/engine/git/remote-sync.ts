/**
 * Copy git objects from one repo to another on the same filesystem.
 */

import git from 'isomorphic-git';
import type FS from '@isomorphic-git/lightning-fs';

/**
 * Copy a commit and all its referenced objects (trees, blobs) from source to target.
 * Recursively copies parent commits too until we find ones that already exist in target.
 */
export async function copyCommitHistory(
  fs: FS,
  fromDir: string,
  toDir: string,
  commitOid: string,
): Promise<void> {
  // Check if commit already exists in target
  try {
    await git.readCommit({ fs, dir: toDir, oid: commitOid });
    return; // Already exists, stop recursion
  } catch {
    // Doesn't exist, need to copy
  }

  // Read the commit from source
  const { commit } = await git.readCommit({ fs, dir: fromDir, oid: commitOid });

  // Recursively copy parent commits first
  for (const parentOid of commit.parent) {
    await copyCommitHistory(fs, fromDir, toDir, parentOid);
  }

  // Copy the tree (and all blobs in it)
  await copyTree(fs, fromDir, toDir, commit.tree);

  // Write the commit object to target
  await git.writeCommit({ fs, dir: toDir, commit });
}

async function copyTree(fs: FS, fromDir: string, toDir: string, treeOid: string): Promise<void> {
  // Check if tree already exists
  try {
    await git.readTree({ fs, dir: toDir, oid: treeOid });
    return;
  } catch {}

  const { tree } = await git.readTree({ fs, dir: fromDir, oid: treeOid });

  for (const entry of tree) {
    if (entry.type === 'blob') {
      await copyBlob(fs, fromDir, toDir, entry.oid);
    } else if (entry.type === 'tree') {
      await copyTree(fs, fromDir, toDir, entry.oid);
    }
  }

  // Write tree to target
  await git.writeTree({ fs, dir: toDir, tree });
}

async function copyBlob(fs: FS, fromDir: string, toDir: string, blobOid: string): Promise<void> {
  try {
    await git.readBlob({ fs, dir: toDir, oid: blobOid });
    return; // Already exists
  } catch {}

  const { blob } = await git.readBlob({ fs, dir: fromDir, oid: blobOid });
  await git.writeBlob({ fs, dir: toDir, blob });
}

/**
 * Check if newOid is a descendant of baseOid (fast-forward check).
 */
export async function isFastForward(
  fs: FS,
  dir: string,
  baseOid: string,
  newOid: string,
): Promise<boolean> {
  if (baseOid === newOid) return true;
  try {
    const result = await git.isDescendent({ fs, dir, oid: newOid, ancestor: baseOid });
    return result;
  } catch {
    return false;
  }
}
