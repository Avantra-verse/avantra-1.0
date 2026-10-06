const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ffmpegBin = require("@ffmpeg-installer/ffmpeg").path;
const videoDir = path.join(__dirname, "public", "video");

const videos = [
  {
    id: "hero",
    input: "asteroid-nebula-hero.mp4",
    outputMp4: "asteroid-nebula-hero-hq.mp4",
    outputWebm: "asteroid-nebula-hero-hq.webm",
    poster: "asteroid-nebula-hero-poster.jpg",
    type: "wide",
  },
  {
    id: "about",
    input: "retro-mountains-moon-potrait.mp4",
    outputMp4: "retro-mountains-moon-portrait-hq.mp4",
    outputWebm: "retro-mountains-moon-portrait-hq.webm",
    poster: "retro-mountains-moon-portrait-poster.jpg",
    type: "portrait",
  },
  {
    id: "dimensions",
    input: "subway-wormhole-stage (2).mp4",
    outputMp4: "subway-wormhole-stage-hq.mp4",
    outputWebm: "subway-wormhole-stage-hq.webm",
    poster: "subway-wormhole-stage-poster.jpg",
    type: "wide",
  },
  {
    id: "timeline",
    input: "planets-gold-dust-timeline.mp4",
    outputMp4: "planets-gold-dust-timeline-hq.mp4",
    outputWebm: "planets-gold-dust-timeline-hq.webm",
    poster: "planets-gold-dust-timeline-poster.jpg",
    type: "wide",
  },
  {
    id: "location",
    input: "neon-hex-tunnel-potrait.mp4",
    outputMp4: "neon-hex-tunnel-portrait-hq.mp4",
    outputWebm: "neon-hex-tunnel-portrait-hq.webm",
    poster: "neon-hex-tunnel-portrait-poster.jpg",
    type: "portrait",
  },
];

console.log(`Using ffmpeg binary at: ${ffmpegBin}`);
console.log("Starting video re-encoding...");

videos.forEach((item, index) => {
  const inputPath = path.join(videoDir, item.input);
  const mp4Path = path.join(videoDir, item.outputMp4);
  const webmPath = path.join(videoDir, item.outputWebm);
  const posterPath = path.join(videoDir, item.poster);
  const framesDir = path.join(videoDir, "frames", item.id);

  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Missing input file: ${item.input}`);
    return;
  }

  console.log(`\n========================================`);
  console.log(`Processing [${index + 1}/5]: ${item.input}`);
  console.log(`========================================`);

  // 1. Poster extraction (first frame)
  console.log(`Extracting poster: ${item.poster}`);
  const posterCmd = `"${ffmpegBin}" -y -i "${inputPath}" -vframes 1 -q:v 2 "${posterPath}"`;
  execSync(posterCmd, { stdio: "inherit" });

  // 2. High-Quality MP4 All-Intra Encoding
  const vfScale =
    item.type === "wide"
      ? "scale=2560:-2:flags=lanczos,unsharp=5:5:0.6"
      : "scale=-2:1280:flags=lanczos,unsharp=5:5:0.6";

  const mp4Cmd = `"${ffmpegBin}" -y -i "${inputPath}" -vf "${vfScale}" -c:v libx264 -preset slow -crf 18 -g 1 -keyint_min 1 -pix_fmt yuv420p -an -movflags +faststart "${mp4Path}"`;
  console.log(`Encoding HQ MP4: ${item.outputMp4}`);
  execSync(mp4Cmd, { stdio: "inherit" });

  // Check MP4 file size - if > 40MB re-encode with -g 2
  let stats = fs.statSync(mp4Path);
  let sizeMb = stats.size / (1024 * 1024);
  console.log(`MP4 size: ${sizeMb.toFixed(2)} MB`);

  if (sizeMb > 40) {
    console.log(`MP4 size exceeds 40MB. Re-encoding with -g 2 & CRF 20...`);
    const mp4Cmd2 = `"${ffmpegBin}" -y -i "${inputPath}" -vf "${vfScale}" -c:v libx264 -preset slow -crf 20 -g 2 -keyint_min 2 -pix_fmt yuv420p -an -movflags +faststart "${mp4Path}"`;
    execSync(mp4Cmd2, { stdio: "inherit" });
    stats = fs.statSync(mp4Path);
    sizeMb = stats.size / (1024 * 1024);
    console.log(`Adjusted MP4 size: ${sizeMb.toFixed(2)} MB`);
  }

  // 3. WebM VP9 Encoding (light copy)
  console.log(`Encoding WebM: ${item.outputWebm}`);
  const webmVf = item.type === "wide" ? "scale=1280:-2:flags=lanczos" : "scale=-2:720:flags=lanczos";
  const webmCmd = `"${ffmpegBin}" -y -i "${inputPath}" -vf "${webmVf}" -c:v libvpx-vp9 -crf 32 -b:v 0 -g 1 -an "${webmPath}"`;
  try {
    execSync(webmCmd, { stdio: "inherit" });
  } catch (err) {
    console.warn(`VP9 WebM encode note, trying VP8 fallback...`);
    const webmCmd8 = `"${ffmpegBin}" -y -i "${inputPath}" -vf "${webmVf}" -c:v libvpx -crf 22 -b:v 1M -g 1 -an "${webmPath}"`;
    execSync(webmCmd8, { stdio: "inherit" });
  }

  // 4. Extract frame sequence for canvas fallback option (24 fps)
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  console.log(`Extracting frame sequence (WebP 24fps) to: frames/${item.id}/`);
  const framesVf = item.type === "wide" ? "scale=1280:-2" : "scale=-2:720";
  const framesCmd = `"${ffmpegBin}" -y -i "${inputPath}" -r 24 -vf "${framesVf}" "${framesDir}/frame_%04d.webp"`;
  execSync(framesCmd, { stdio: "inherit" });
});

console.log("\nAll 5 videos re-encoded successfully!");
