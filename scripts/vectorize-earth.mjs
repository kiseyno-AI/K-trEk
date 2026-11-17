import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = new URL('../public/trip/earth-night-intro.png', import.meta.url);
const target = new URL(
  '../public/trip/earth-night-vector.svg',
  import.meta.url,
);
const width = 1200;
const height = 675;
const quantized = await sharp(fileURLToPath(source))
  .resize(width, height, { fit: 'fill' })
  .png({ palette: true, colours: 192, dither: 0.7 })
  .toBuffer();
const { data } = await sharp(quantized)
  .raw()
  .ensureAlpha()
  .toBuffer({ resolveWithObject: true });
const paths = new Map();

for (let y = 0; y < height; y += 1) {
  let start = 0;
  for (let x = 1; x <= width; x += 1) {
    const previous = (y * width + x - 1) * 4;
    const current = (y * width + x) * 4;
    const same =
      x < width &&
      data[previous] === data[current] &&
      data[previous + 1] === data[current + 1] &&
      data[previous + 2] === data[current + 2];
    if (same) continue;
    const color = `${data[previous].toString(16).padStart(2, '0')}${data[previous + 1].toString(16).padStart(2, '0')}${data[previous + 2].toString(16).padStart(2, '0')}`;
    paths.set(
      color,
      `${paths.get(color) ?? ''}M${start} ${y}h${x - start}v1H${start}z`,
    );
    start = x;
  }
}

await writeFile(
  target,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">${[...paths].map(([color, d]) => `<path fill="#${color}" d="${d}"/>`).join('')}</svg>`,
);
console.log(`Wrote ${paths.size} compound vector paths to ${target.pathname}`);
