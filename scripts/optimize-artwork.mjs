import { access, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const artwork = [
  {
    sources: [
      "hero-image.png",
      "public/images/hero/hero-image.png",
    ],
    destination: "public/images/hero/hero-image.webp",
    maxWidth: 2400,
    quality: 86,
  },

  {
    sources: [
      "bull-card.jpeg",
      "public/images/cards/ansem/ansem-card-01.jpeg",
    ],
    destination: "public/images/cards/ansem/ansem-card-01.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "bull-card1.jpeg",
      "public/images/cards/ansem/ansem-card-02.jpeg",
    ],
    destination: "public/images/cards/ansem/ansem-card-02.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "bull-cards.jpeg",
      "public/images/cards/ansem/ansem-card-03.jpeg",
    ],
    destination: "public/images/cards/ansem/ansem-card-03.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "bullcard.jpeg",
      "public/images/cards/ansem/ansem-card-04.jpeg",
    ],
    destination: "public/images/cards/ansem/ansem-card-04.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "bulls.jpeg",
      "public/images/cards/ansem/ansem-card-05.jpeg",
    ],
    destination: "public/images/cards/ansem/ansem-card-05.webp",
    maxWidth: 1600,
    quality: 82,
  },

  {
    sources: [
      "goat-trump.jpeg",
      "public/images/cards/poorgoat/goat-card-01.jpeg",
    ],
    destination: "public/images/cards/poorgoat/goat-card-01.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "goat.jpeg",
      "public/images/cards/poorgoat/goat-card-02.jpeg",
    ],
    destination: "public/images/cards/poorgoat/goat-card-02.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "goaty.jpeg",
      "public/images/cards/poorgoat/goat-card-03.jpeg",
    ],
    destination: "public/images/cards/poorgoat/goat-card-03.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "head-goat.jpeg",
      "public/images/cards/poorgoat/goat-card-04.jpeg",
    ],
    destination: "public/images/cards/poorgoat/goat-card-04.webp",
    maxWidth: 1600,
    quality: 82,
  },
  {
    sources: [
      "poorgoat.jpeg",
      "public/images/cards/poorgoat/goat-card-05.jpeg",
    ],
    destination: "public/images/cards/poorgoat/goat-card-05.webp",
    maxWidth: 1600,
    quality: 82,
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

let originalTotal = 0;
let optimisedTotal = 0;
let convertedCount = 0;

for (const item of artwork) {
  const source = await (async () => {
    for (const candidate of item.sources) {
      if (await exists(candidate)) {
        return candidate;
      }
    }

    return null;
  })();

  if (!source) {
    console.warn(`Missing artwork: ${item.sources[0]}`);
    continue;
  }

  await mkdir(path.dirname(item.destination), {
    recursive: true,
  });

  const sourceStats = await stat(source);

  await sharp(source)
    .rotate()
    .resize({
      width: item.maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: item.quality,
      effort: 5,
      smartSubsample: true,
    })
    .toFile(item.destination);

  const destinationStats = await stat(item.destination);

  originalTotal += sourceStats.size;
  optimisedTotal += destinationStats.size;
  convertedCount += 1;

  if (path.resolve(source) !== path.resolve(item.destination)) {
    await rm(source);
  }

  console.log(
    `Converted ${path.basename(source)}: ` +
      `${formatSize(sourceStats.size)} → ${formatSize(destinationStats.size)}`,
  );
}

console.log("");
console.log(`Converted ${convertedCount} artwork files.`);

if (convertedCount > 0) {
  const reduction =
    ((originalTotal - optimisedTotal) / originalTotal) * 100;

  console.log(
    `Total: ${formatSize(originalTotal)} → ${formatSize(optimisedTotal)}`,
  );
  console.log(`Size reduction: ${reduction.toFixed(1)}%`);
}