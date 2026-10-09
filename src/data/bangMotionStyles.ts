export interface BangMotionStyle {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  prompt: string;
  accentColor: string;
}

export const BANG_MOTION_STYLES: BangMotionStyle[] = [
  {
    id: "grainy-gradient",
    name: "Grainy Gradient",
    category: "Opener",
    description: "Glowing layered shapes, soft grain, camera travels through them. Tech, AI, premium launches.",
    image: "/gallery/01-grainy-gradient.jpg",
    accentColor: "#6366f1",
    prompt: `Create a cinematic Grainy Gradient opener with deep atmospheric backdrop (#0c0f1d) and luminous radial glows in indigo (#6366f1) and amber (#f59e0b). 
Follow Anti-PPT rules: camera travels through continuous depth, kinetic title enters with smooth spring bounce, floating micro-particles oscilate naturally.`,
  },
  {
    id: "kinetic-colorblock",
    name: "Poster Color-Block",
    category: "Typo",
    description: "Huge cropped words, solid color fields that slam on the beat. Events, music, teasers.",
    image: "/gallery/02-kinetic-colorblock.jpg",
    accentColor: "#ff2d55",
    prompt: `A high-impact Poster Color-Block kinetic typography animation.
Bold contrasting color fields (#ff2d55, #000000, #ffffff) that transition dynamically. Giant cropped impact words enter on the beat with snappy spring physics and subtle camera breathing.`,
  },
  {
    id: "saas-ui-tour",
    name: "SaaS Product Tour",
    category: "Product",
    description: "Real UI lifted out of dashboard, camera zooms into what gets clicked. SaaS, dashboards, B2B.",
    image: "/gallery/03-saas-ui-tour.jpg",
    accentColor: "#3b82f6",
    prompt: `A living SaaS product tour animation.
Reconstructed modern dark-mode dashboard card with real interactive metrics climbing upwards. Camera zooms in smoothly (scale 1.5) to an action button being clicked, then pans out to reveal updated data with staggered badges.`,
  },
  {
    id: "flat-vector",
    name: "Flat Vector Illustration",
    category: "Promo",
    description: "Solid fills, stylized UI drawn flat, shapes with gentle overshoot. Fintech, consumer apps.",
    image: "/gallery/04-flat-vector.jpg",
    accentColor: "#10b981",
    prompt: `Flat vector illustration promo with clean geometric shapes and solid color fills.
Floating interface cards enter with gentle spring overshoot. Staggered decorative badges and clean minimalist icon elements.`,
  },
  {
    id: "continuous-action",
    name: "Continuous Action",
    category: "Explainer",
    description: "One subject that never stops, numbers and maps living inside the world. Routes, processes.",
    image: "/gallery/05-continuous-action.jpg",
    accentColor: "#f59e0b",
    prompt: `Continuous action explainer. 
Follow Anti-PPT rules: a central hero subject advances across the frame while the surrounding environment transforms seamlessly without jump cuts. Live metric counters and route markers pop up along the timeline.`,
  },
  {
    id: "cartoon-stage",
    name: "Cartoon Stage",
    category: "Storytelling",
    description: "One living stage per scene, jointed characters, no captions. Education with characters.",
    image: "/gallery/06-cartoon-stage.jpg",
    accentColor: "#ec4899",
    prompt: `Cartoon stage animated scene.
A vibrant foreground-midground-background theatrical stage. Animated character card and props enter with playful spring bounces. Speech bubbles and expressive emoji badges pop in with staggered timing.`,
  },
  {
    id: "flat-pop-photo",
    name: "Flat Pop with Photos",
    category: "Campaign",
    description: "Photo cutouts popping in, stickers, brand color fields changing on trigger. Consumer apps.",
    image: "/gallery/07-flat-pop-photo.jpg",
    accentColor: "#8b5cf6",
    prompt: `Flat pop promo with photo cutout stickers popping in with snappy tilt rotations.
Animated highlighter marks, bold sentence-case headline, and vibrant backdrop color change triggered on the beat.`,
  },
  {
    id: "white-catalog",
    name: "White Catalog",
    category: "Showcase",
    description: "White grid, product cutouts, mixed script and heavy sans typography. Products, brands.",
    image: "/gallery/08-white-catalog.jpg",
    accentColor: "#64748b",
    prompt: `Elegant White Catalog motion graphic.
Ultra-clean light aesthetic (#f8fafc) with subtle architectural grid lines. Staggered product cards floating in 2.5D space with high-contrast editorial typography and smooth linear progress accents.`,
  },
  {
    id: "visual-journalism",
    name: "Visual Journalism",
    category: "News",
    description: "Black ground, real photos with source tags, highlighter, dashed annotations. News, reports.",
    image: "/gallery/09-visual-journalism.jpg",
    accentColor: "#ef4444",
    prompt: `Visual journalism news explainer.
Deep charcoal black ground (#09090b), prominent 'BREAKING REPORT' tag, photo card with source metadata label, yellow highlighter animated across key headline text, and dashed annotation lines connecting facts.`,
  },
  {
    id: "vintage-sketch",
    name: "Vintage Sketch",
    category: "Documentary",
    description: "Sepia paper, engraving art, classic serifs, rust notes. History, biography.",
    image: "/gallery/10-vintage-sketch.jpg",
    accentColor: "#b45309",
    prompt: `Vintage sketch historical explainer.
Warm aged parchment paper backdrop (#f5ebe0), classic elegant serif typography, rust-colored accent stamps (#9a3412), and decorative engraved border lines revealing with smooth interpolate draws.`,
  },
  {
    id: "cartoon-collage",
    name: "Cartoon Collage",
    category: "Education",
    description: "Cream paper, flat illustration cutouts, color pills, handwriting. Science, explainer.",
    image: "/gallery/11-cartoon-collage.jpg",
    accentColor: "#06b6d4",
    prompt: `Cartoon collage explainer on textured cream paper (#fffbeb).
Cutout illustration elements, colorful rounded pill badges, playful handwritten style notes, and bouncy spring entrances with subtle paper shadow elevation.`,
  },
];
