import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MasterProfile } from "./types";

type ParsedFrontmatter = {
  name?: string;
  description?: string;
};

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { meta: {} as ParsedFrontmatter, body: markdown };
  }

  const meta: ParsedFrontmatter = {};
  for (const line of match[1].split("\n")) {
    const [rawKey, ...rawValue] = line.split(":");
    if (!rawKey || !rawValue.length) continue;
    const key = rawKey.trim();
    const value = rawValue.join(":").trim();
    if (key === "name") meta.name = value;
    if (key === "description") meta.description = value;
  }

  return {
    meta,
    body: markdown.slice(match[0].length).trim(),
  };
}

const skillCache = new Map<string, Promise<Pick<MasterProfile, "skillMarkdown" | "skillName" | "skillDescription">>>();

async function loadSkillBySlug(skillSlug: string) {
  const filePath = path.join(process.cwd(), "agent-backend", "skills", "investor-personas", skillSlug, "SKILL.md");
  const markdown = await readFile(filePath, "utf8");
  const { meta, body } = parseFrontmatter(markdown);
  return {
    skillMarkdown: body,
    skillName: meta.name ?? skillSlug,
    skillDescription: meta.description ?? "",
  };
}

export async function hydrateMasterSkill(master: MasterProfile): Promise<MasterProfile> {
  if (!skillCache.has(master.skillSlug)) {
    skillCache.set(master.skillSlug, loadSkillBySlug(master.skillSlug));
  }
  const skill = await skillCache.get(master.skillSlug)!;
  return {
    ...master,
    ...skill,
  };
}

export async function hydrateMasters(masters: MasterProfile[]) {
  return Promise.all(masters.map((master) => hydrateMasterSkill(master)));
}
