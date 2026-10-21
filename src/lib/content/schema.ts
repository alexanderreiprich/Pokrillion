import { z } from "zod";

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LocalizedText = z.object({
  de: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const ENTITY_KINDS = [
  "pokemon",
  "type",
  "location",
  "region",
  "move",
  "item",
  "ability",
  "character",
  "game",
  "team",
] as const;
export const EntityKind = z.enum(ENTITY_KINDS);
export type EntityKind = z.infer<typeof EntityKind>;

/** `<kind>:<slug>`, e.g. `pokemon:pikachu`, `location:mt-moon`, `character:misty`. */
export const EntityId = z
  .string()
  .regex(/^[a-z]+:[a-z0-9-]+$/, "Entity-IDs haben die Form <kind>:<slug>");

export const AttrValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export const Entity = z.object({
  id: EntityId,
  kind: EntityKind,
  names: LocalizedText,
  /** Additional accepted spellings (any language). Normalized at build time. */
  aliases: z.array(z.string().min(1)).default([]),
  attrs: z.record(z.string(), AttrValue).default({}),
  /** 1 = obscure, 100 = everybody knows it. Drives the scoring prior. */
  familiarity: z.number().int().min(1).max(100),
});
export type Entity = z.infer<typeof Entity>;

export const QUESTION_CATEGORIES = ["pokedex", "games", "anime"] as const;
export const QuestionCategory = z.enum(QUESTION_CATEGORIES);
export type QuestionCategory = z.infer<typeof QuestionCategory>;

/**
 * Selects entities from the generated/curated data.
 * `where`: every key must match the entity attr. Array attrs match if they contain the value,
 * array values match if any element matches.
 * `nameMatches`: case-insensitive regex tested against the DE and EN name.
 * `idMatches`: regex tested against the entity id (e.g. `-(city|town)$` for settlements).
 */
export const AnswerQuery = z.object({
  kind: EntityKind,
  where: z.record(z.string(), AttrValue).optional(),
  nameMatches: z.string().optional(),
  idMatches: z.string().optional(),
});
export type AnswerQuery = z.infer<typeof AnswerQuery>;

export const QuestionAnswers = z
  .object({
    /** One query, or several whose results are united. */
    query: z.union([AnswerQuery, z.array(AnswerQuery).min(1)]).optional(),
    list: z.array(EntityId).optional(),
    include: z.array(EntityId).default([]),
    exclude: z.array(EntityId).default([]),
  })
  .refine((a) => a.query || a.list, "answers braucht `query` oder `list`");

export const Question = z.object({
  id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
  category: QuestionCategory,
  /** Questions sharing a group never appear on the same day (e.g. two colour questions). */
  group: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  timeLimitS: z.number().int().min(10).max(60).default(25),
  cooldownDays: z.number().int().min(0).default(120),
  /** Inactive questions are validated and seeded but never scheduled. */
  active: z.boolean().default(true),
  prompt: LocalizedText,
  answers: QuestionAnswers,
  /** Entity kinds used as the fuzzy-matching universe. Defaults to the kinds of the answers. */
  universe: z.array(EntityKind).optional(),
  /** The curated 100-point answer. Must be part of the answer set. */
  masterball: EntityId,
  source: z.string().optional(),
  notes: z.string().optional(),
});
export type Question = z.infer<typeof Question>;

export const QuestionFile = z.array(Question);
export const EntityFile = z.array(Entity);
export const FamiliarityFile = z.record(EntityId, z.number().int().min(1).max(100));
