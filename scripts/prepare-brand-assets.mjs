import { rm, stat } from "node:fs/promises";
import sharp from "sharp";

async function convert({
  source,
  destination,
  width,
  quality,
}) {
  const before = await stat(source);

  await sharp(source)
    .rotate()
    .resize({
      width,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality,
      alphaQuality: 100,
      effort: 5,
      smartSubsample: true,
    })
    .toFile(destination);

  const after = await stat(destination);

  console.log(
    `${source}: ${(before.size / 1024).toFixed(1)} KB -> ` +
      `${(after.size / 1024).toFixed(1)} KB`,
  );

  await rm(source);
}

await convert({
  source: "logo.png",
  destination: "public/images/brand/logo.webp",
  width: 800,
  quality: 92,
});

await convert({
  source: "goat-landing.png",
  destination: "public/images/landing/goat-landing.webp",
  width: 2400,
  quality: 86,
});

console.log("Brand assets prepared successfully.");