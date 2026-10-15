export interface SingleHtmlOptions {
  title: string;
  videoUrl?: string;
  audioUrl?: string;
  script?: string;
  captions?: Array<{ word: string; start: number; end: number }>;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  width?: number;
  height?: number;
}

export function generateSingleHtml(options: SingleHtmlOptions): string {
  const {
    title = "Swdbot Motion Animation",
    videoUrl = "",
    audioUrl = "",
    script = "",
    captions = [],
    aspectRatio = "16:9",
    width = 1920,
    height = 1080,
  } = options;

  const aspectClass =
    aspectRatio === "9:16"
      ? "max-w-[420px] aspect-[9/16]"
      : aspectRatio === "1:1"
        ? "max-w-[620px] aspect-square"
        : "max-w-[1080px] aspect-video";

  const captionsJson = JSON.stringify(captions);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Swdbot Motion</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #f5f5f7;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      width: 100%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #18181b;
      border: 1px solid #28282c;
      border-radius: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.02em;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #27272a;
      color: #fbbf24;
      border: 1px solid #3f3f46;
    }
    .player-wrapper {
      position: relative;
      width: 100%;
      background: #121214;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #28282c;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .aspect-video { aspect-ratio: 16/9; }
    .aspect-square { aspect-ratio: 1/1; }
    .aspect-\\[9\\/16\\] { aspect-ratio: 9/16; }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #000;
    }
    .caption-overlay {
      position: absolute;
      bottom: 70px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      padding: 0 20px;
      pointer-events: none;
      z-index: 10;
    }
    .caption-box {
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(12px);
      padding: 8px 18px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-weight: 700;
      font-size: 20px;
      color: #fff;
      text-align: center;
      max-width: 85%;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .highlight-word {
      color: #fbbf24;
      text-shadow: 0 0 16px rgba(251, 191, 36, 0.6);
    }
    .script-section {
      width: 100%;
      background: #18181b;
      border: 1px solid #28282c;
      border-radius: 14px;
      padding: 18px 22px;
    }
    .script-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9a9aa2;
      margin-bottom: 8px;
    }
    .script-text {
      font-size: 14px;
      line-height: 1.6;
      color: #d4d4d8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <span>🎬</span>
        <span>${escapeHtml(title)}</span>
      </div>
      <div class="badge">${aspectRatio} • ${width}x${height}</div>
    </div>

    <div class="player-wrapper ${aspectClass}">
      <video id="player" controls autoplay loop playsinline>
        ${videoUrl ? `<source src="${escapeHtml(videoUrl)}" type="video/mp4">` : ""}
        ${audioUrl && !videoUrl ? `<source src="${escapeHtml(audioUrl)}" type="audio/wav">` : ""}
      </video>
      <div id="captionOverlay" class="caption-overlay" style="display: none;">
        <div id="captionBox" class="caption-box"></div>
      </div>
    </div>

    ${
      script
        ? `
    <div class="script-section">
      <div class="script-title">Narration Script</div>
      <div class="script-text">${escapeHtml(script)}</div>
    </div>`
        : ""
    }
  </div>

  <script>
    const captions = ${captionsJson};
    const video = document.getElementById('player');
    const overlay = document.getElementById('captionOverlay');
    const box = document.getElementById('captionBox');

    if (captions && captions.length > 0 && video) {
      overlay.style.display = 'flex';
      video.addEventListener('timeupdate', () => {
        const t = video.currentTime;
        const currentWord = captions.find(c => t >= c.start && t <= c.end);
        if (currentWord) {
          // Find window of +- 2 words
          const idx = captions.indexOf(currentWord);
          const startIdx = Math.max(0, idx - 2);
          const endIdx = Math.min(captions.length, idx + 3);
          const slice = captions.slice(startIdx, endIdx);
          box.innerHTML = slice.map(w => w === currentWord 
            ? '<span class="highlight-word">' + w.word + '</span>' 
            : w.word).join(' ');
        } else {
          box.innerHTML = '';
        }
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
