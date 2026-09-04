// One-off favicon generator, run manually after dropping the source logo
// at public/logo-source.png. Not part of the build -- Next.js's own
// app/icon.png and app/apple-icon.png file-convention (see app/) picks up
// the generated files automatically and emits the right <link> tags.
import sharp from "sharp";
import { existsSync } from "node:fs";

const SRC = "public/logo-source.png";

if (!existsSync(SRC)) {
  console.error(`Source not found: ${SRC}. Save the icon-only logo there first.`);
  process.exit(1);
}

const targets = [
  { out: "app/icon.png", size: 512 },
  { out: "app/apple-icon.png", size: 180 },
  { out: "public/favicon-16x16.png", size: 16 },
  { out: "public/favicon-32x32.png", size: 32 },
  { out: "public/android-chrome-192x192.png", size: 192 },
  { out: "public/android-chrome-512x512.png", size: 512 },
];

for (const t of targets) {
  await sharp(SRC).resize(t.size, t.size, { fit: "cover" }).png().toFile(t.out);
  console.log(`wrote ${t.out} (${t.size}x${t.size})`);
}
