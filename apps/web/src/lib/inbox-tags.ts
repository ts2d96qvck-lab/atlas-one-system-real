import type { TagCatalogItem } from "./api";

const RESERVED_PREFIXES = ["avatar:", "atlas-"];

export function conversationDisplayTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .map((tag) => tag.trim())
    .filter((tag) => !RESERVED_PREFIXES.some((prefix) => tag.toLowerCase().startsWith(prefix)));
}

export function mergeConversationTags(current: unknown, displayTags: string[]): string[] {
  const preserved = Array.isArray(current)
    ? current.filter(
        (tag): tag is string =>
          typeof tag === "string" &&
          RESERVED_PREFIXES.some((prefix) => tag.toLowerCase().startsWith(prefix))
      )
    : [];
  const normalized = displayTags.map((tag) => tag.trim()).filter(Boolean);
  const unique = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...preserved, ...normalized]) {
    const key = tag.toLowerCase();
    if (unique.has(key)) continue;
    unique.add(key);
    merged.push(tag);
  }
  return merged;
}

export function tagCatalogColor(name: string, catalog: TagCatalogItem[]) {
  const found = catalog.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return found?.color;
}

export function tagChipStyle(name: string, catalog: TagCatalogItem[]) {
  const color = tagCatalogColor(name, catalog);
  if (!color) return undefined;
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}55`,
    color
  } as const;
}
