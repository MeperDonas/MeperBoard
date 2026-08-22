import { githubItemRepo, localItemRepo } from "../data/repositories";

/**
 * Move persistence for the kanban board.
 *
 * The board reports moves as `{ cardId, toColumnId }` (see `BoardMove`); this
 * module turns a reported move into a store write, routing by card source:
 *
 * - `local:{id}`    → update the local card's `column_id` in place (the board
 *                     move never touches GitHub).
 * - `github:{repo}:{number}` → write a `column_overrides` row so the move
 *                     survives re-sync (a re-sync re-maps GitHub state but
 *                     never clobbers the user's manual column choice).
 */

/** A card move reduced to the fields persistence needs. */
export interface CardMove {
  cardId: string;
  toColumnId: string;
}

/** Extract the raw local id from a `local:{id}` card id, or `null`. */
export function parseLocalCardId(cardId: string): string | null {
  if (!cardId.startsWith("local:")) return null;
  return cardId.slice("local:".length);
}

export interface GithubCardRef {
  repo: string;
  number: number;
}

/**
 * Extract `{ repo, number }` from a `github:{repo}:{number}` card id, or `null`
 * when the id is not a valid GitHub card id.
 */
export function parseGithubCardId(cardId: string): GithubCardRef | null {
  if (!cardId.startsWith("github:")) return null;
  const rest = cardId.slice("github:".length);
  const separator = rest.lastIndexOf(":");
  if (separator === -1) return null;

  const repo = rest.slice(0, separator);
  const number = Number.parseInt(rest.slice(separator + 1), 10);
  if (repo.length === 0 || !Number.isFinite(number)) return null;
  return { repo, number };
}

/** Persist a reported card move to the appropriate store. */
export async function persistCardMove(move: CardMove): Promise<void> {
  const localId = parseLocalCardId(move.cardId);
  if (localId != null) {
    const item = await localItemRepo.get(localId);
    if (!item) throw new Error(`Local card not found: ${localId}`);
    await localItemRepo.upsert({ ...item, column_id: move.toColumnId });
    return;
  }

  const ref = parseGithubCardId(move.cardId);
  if (ref != null) {
    await githubItemRepo.setColumnOverride(ref.repo, ref.number, move.toColumnId);
    return;
  }

  throw new Error(`Unknown card id: ${move.cardId}`);
}

/** Clear any manual column override on a GitHub card, reverting to its default state. */
export async function resetCardMove(cardId: string): Promise<void> {
  const ref = parseGithubCardId(cardId);
  if (ref != null) {
    await githubItemRepo.clearColumnOverride(ref.repo, ref.number);
  }
}
