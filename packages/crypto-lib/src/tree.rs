use crate::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MerkleTree {
    pub count: usize,
    levels: Vec<Vec<String>>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerklePath {
    pub leaf_index: usize,
    pub merkle_path: Vec<String>,
}
/// Reproducible filler data for the demo; encoded exactly like a participant.
pub fn filler_leaf(index: usize) -> Result<LeafData> {
    if index >= LEAF_COUNT {
        return Err(Error::InvalidIndex);
    }
    Ok(LeafData {
        address: format!("0x{:040x}", index + 1),
        secret: (65536 + index).to_string(),
        nullifier_seed: (131072 + index).to_string(),
        tier_key: "0".into(),
    })
}
/// Every slot contains hash_leaf(data), including automatically generated leaves.
pub fn build_tree_from_hashes(leaves: &[String]) -> Result<MerkleTree> {
    if leaves.is_empty() || leaves.len() > LEAF_COUNT {
        return Err(Error::InvalidCount);
    }
    let mut row = leaves
        .iter()
        .map(|v| normalize_field(v))
        .collect::<Result<Vec<_>>>()?;
    if row.iter().collect::<HashSet<_>>().len() != row.len() {
        return Err(Error::DuplicateLeaf);
    }
    for index in row.len()..LEAF_COUNT {
        row.push(hash_leaf(&filler_leaf(index)?)?);
    }
    let mut levels = vec![row];
    for i in 0..TREE_DEPTH {
        levels.push(
            levels[i]
                .chunks_exact(2)
                .map(|p| hash_children(&p[0], &p[1]))
                .collect::<Result<Vec<_>>>()?,
        );
    }
    Ok(MerkleTree {
        count: leaves.len(),
        levels,
    })
}
pub fn build_tree(accounts: &[LeafData]) -> Result<MerkleTree> {
    build_tree_from_hashes(&accounts.iter().map(hash_leaf).collect::<Result<Vec<_>>>()?)
}
impl MerkleTree {
    pub fn root(&self) -> &str {
        &self.levels[TREE_DEPTH][0]
    }
    pub fn levels(&self) -> &[Vec<String>] {
        &self.levels
    }
    pub fn validate(&self) -> Result<()> {
        if self.count == 0
            || self.count > LEAF_COUNT
            || self.levels.len() != TREE_DEPTH + 1
            || self
                .levels
                .iter()
                .enumerate()
                .any(|(i, row)| row.len() != LEAF_COUNT >> i)
        {
            return Err(Error::InvalidTree);
        }
        let rebuilt = build_tree_from_hashes(&self.levels[0][..self.count])?;
        for (a, b) in self
            .levels
            .iter()
            .flatten()
            .zip(rebuilt.levels.iter().flatten())
        {
            if normalize_field(a)? != *b {
                return Err(Error::InvalidTree);
            }
        }
        Ok(())
    }
    pub fn merkle_path(&self, index: usize) -> Result<Vec<String>> {
        if index >= LEAF_COUNT {
            return Err(Error::InvalidIndex);
        }
        if self.levels.len() != TREE_DEPTH + 1
            || self
                .levels
                .iter()
                .enumerate()
                .any(|(i, row)| row.len() != LEAF_COUNT >> i)
        {
            return Err(Error::InvalidTree);
        }
        (0..TREE_DEPTH)
            .map(|level| normalize_field(&self.levels[level][(index >> level) ^ 1]))
            .collect()
    }
    pub fn find_path(&self, leaf: &str) -> Result<MerklePath> {
        self.validate()?;
        let leaf = normalize_field(leaf)?;
        let index = self.levels[0]
            .iter()
            .position(|v| normalize_field(v).ok().as_deref() == Some(leaf.as_str()))
            .ok_or(Error::LeafNotFound)?;
        Ok(MerklePath {
            leaf_index: index,
            merkle_path: self.merkle_path(index)?,
        })
    }
}
pub fn root_from_path(leaf: &str, path: &[String], index: usize) -> Result<String> {
    if index >= LEAF_COUNT {
        return Err(Error::InvalidIndex);
    }
    if path.len() != TREE_DEPTH {
        return Err(Error::InvalidTree);
    }
    let mut current = normalize_field(leaf)?;
    for (i, sibling) in path.iter().enumerate() {
        current = if (index >> i) & 1 == 0 {
            hash_children(&current, sibling)?
        } else {
            hash_children(sibling, &current)?
        };
    }
    Ok(current)
}
