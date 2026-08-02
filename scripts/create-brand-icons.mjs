import sharp from "sharp";

const source = "public/images/brand/logo.webp";

await sharp(source)
  .resize({
    width: 512,
    height: 512,
    fit: "contain",
    background: {
      r: 5,
      g: 7,
      b: 5,
      alpha: 1,
    },
  })
  .png()
  .toFile("src/app/icon.png");

await sharp(source)
  .resize({
    width: 180,
    height: 180,
    fit: "contain",
    background: {
      r: 5,
      g: 7,
      b: 5,
      alpha: 1,
    },
  })
  .png()
  .toFile("src/app/apple-icon.png");

console.log("PoorGoat favicon and Apple icon created.");