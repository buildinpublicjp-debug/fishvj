// deck.schema v0 — FISHVJ_DESIGN_V2.md §7.
//
// v0 externalizes exactly two per-species render values from FishCanvas:
//   species[index].scale, species[index].motion
// Everything else (atlas layout, species count, motion families, mode/macro/
// scene/swarm math) stays internal and is declared under `internal` as reserved
// keys the renderer does not read. See §7.1 boundary and §7.2 invariance scope.
import rawDeck from "./decks/gyogen-v0.json";
import { sha256Hex } from "./sha256";
import type { SwimType } from "./types";

const MOTIONS: SwimType[] = ["SCHOOL", "GLIDE", "WAVE", "FLOAT"];
const swimValue = (s: SwimType) => MOTIONS.indexOf(s);

export type DeckSpecies = { index: number; scale: number; motion: SwimType };

export type Deck = {
  v: 0;
  id: string;
  name: string;
  species: DeckSpecies[];
};

export type LoadedDeck = {
  id: string;
  name: string;
  contentHash: string;
  /** species[i].scale, in index order. */
  speciesScales: number[];
  /** swimValue(species[i].motion), in index order — the numeric motion FishCanvas uses. */
  speciesMotions: number[];
};

/**
 * Validates a deck against the v0 contract and returns the render-facing values.
 * `species` is length 8, `index` is 0..7 ascending and fixed; reorder / add /
 * delete is a validation error (§7.1).
 */
export function loadDeck(input: unknown): LoadedDeck {
  const deck = input as Deck;
  if (!deck || deck.v !== 0) throw new RangeError("deck schema version must be 0");
  if (typeof deck.id !== "string" || !deck.id) throw new RangeError("deck id must be a non-empty string");
  if (!Array.isArray(deck.species) || deck.species.length !== 8) {
    throw new RangeError("deck species must be length 8");
  }

  const speciesScales: number[] = [];
  const speciesMotions: number[] = [];
  deck.species.forEach((species, position) => {
    if (species.index !== position) {
      throw new RangeError(`deck species[${position}] index must be ${position} (ascending, fixed)`);
    }
    if (!Number.isFinite(species.scale) || species.scale <= 0 || species.scale > 4) {
      throw new RangeError(`deck species[${position}] scale out of range`);
    }
    if (!MOTIONS.includes(species.motion)) {
      throw new RangeError(`deck species[${position}] motion is invalid`);
    }
    speciesScales.push(species.scale);
    speciesMotions.push(swimValue(species.motion));
  });

  return {
    id: deck.id,
    name: deck.name,
    // Canonical JSON of the full deck literal (stable key order as authored).
    contentHash: `sha256:${sha256Hex(JSON.stringify(rawDeck))}`,
    speciesScales,
    speciesMotions,
  };
}

/** The bundled default deck, validated at module load. */
export const deck = loadDeck(rawDeck);
