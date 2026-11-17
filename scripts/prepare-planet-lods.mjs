import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../public/trip/night/', import.meta.url);
const { countries } = JSON.parse(
  await readFile(new URL('../korea-10m.json', root), 'utf8'),
);
const bounds = { west: 116, east: 139, south: 27, north: 44 };
const width = 2048,
  height = 3072;
const paths = Object.values(countries).flatMap((polygons) =>
  polygons.map((polygon) =>
    polygon
      .map(
        (ring) =>
          ring
            .map(
              ([longitude, latitude], index) =>
                `${index ? 'L' : 'M'}${(((longitude - bounds.west) / (bounds.east - bounds.west)) * width).toFixed(2)},${(((bounds.north - latitude) / (bounds.north - bounds.south)) * height).toFixed(2)}`,
            )
            .join(' ') + 'Z',
      )
      .join(' '),
  ),
);
const koreaPolygonCount = Object.entries(countries)
  .filter(([name]) => name.includes('Korea'))
  .reduce((count, [, polygons]) => count + polygons.length, 0);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/><path d="${paths.slice(koreaPolygonCount).join(' ')}" fill="#00ff00" fill-rule="evenodd"/><path d="${paths.slice(0, koreaPolygonCount).join(' ')}" fill="#ff0000" fill-rule="evenodd"/></svg>`;
await sharp(Buffer.from(svg))
  .blur(2)
  .resize(1024, 1536)
  .png()
  .toFile(new URL('korea-mask.png', root).pathname);
console.log('Prepared Korea and unlit China/Japan geographic silhouettes');
