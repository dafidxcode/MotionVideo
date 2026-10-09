// Import markdown files at build time strictly from Bang Motion references
import antiPptSkill from "./anti-ppt.md";
import architectureSkill from "./architecture.md";
import explainerSkill from "./explainer.md";
import kartunPanggungSkill from "./kartun-panggung.md";
import openerKonsepSkill from "./opener-konsep.md";
import roadmapSkill from "./roadmap.md";
import techniquesSkill from "./techniques.md";

// Guidance skills strictly from Bang Motion
export const GUIDANCE_SKILLS = [
  "anti-ppt",
  "architecture",
  "opener-konsep",
  "explainer",
  "kartun-panggung",
  "techniques",
  "roadmap",
] as const;

export const SKILL_NAMES = [...GUIDANCE_SKILLS] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

// Map guidance skill names to imported content
const guidanceSkillContent: Record<(typeof GUIDANCE_SKILLS)[number], string> = {
  "anti-ppt": antiPptSkill,
  architecture: architectureSkill,
  "opener-konsep": openerKonsepSkill,
  explainer: explainerSkill,
  "kartun-panggung": kartunPanggungSkill,
  techniques: techniquesSkill,
  roadmap: roadmapSkill,
};

export function getSkillContent(skillName: SkillName): string {
  return guidanceSkillContent[skillName] || "";
}

export function getCombinedSkillContent(skills: SkillName[]): string {
  if (skills.length === 0) {
    return "";
  }

  const contents = skills
    .map((skill) => getSkillContent(skill))
    .filter((content) => content.length > 0);

  return contents.join("\n\n---\n\n");
}

export const SKILL_DETECTION_PROMPT = `Classify this motion graphics prompt into ALL applicable Bang Motion skill categories:
- anti-ppt: MUST BE INCLUDED for any motion graphic, teaser, promo, or video to enforce Bang Motion's core continuous world & cinematic non-PPT laws (camera movement, no static slide deck fades)
- opener-konsep: openers, promo teasers, kinetic typography, brand reveals, SaaS product tours, marketing hype
- explainer: visual journalism, news breakdowns, tutorials, continuous action, white catalog, vintage sketch
- kartun-panggung: cartoon stage scenes, character animation, illustrated collage, props with spring bounces
- techniques: camera motion, 2.5D depth, parallax, whip pans, zoom push-through, lighting & grain
- architecture: spatial staging, viewport scaling, layer hierarchy
- roadmap: timeline animation, milestones, chronological steps

Return an array of matching category names.`;
