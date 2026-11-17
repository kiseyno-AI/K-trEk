import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../public/trip/night/', import.meta.url);
await mkdir(root, { recursive: true });

// NASA GIBS geographic tiles use 2.25 degree cells at matrix 7.
const nationalTiles = [];
for (let row = 21; row <= 26; row += 1) {
  for (let column = 135; column <= 138; column += 1) {
    nationalTiles.push({ row, column });
  }
}
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}
async function batch(items, work) {
  const result = [];
  for (let index = 0; index < items.length; index += 6) {
    result.push(
      ...(await Promise.all(items.slice(index, index + 6).map(work))),
    );
  }
  return result.filter(Boolean);
}
const national = await batch(nationalTiles, async ({ row, column }) => {
  const input = await download(
    `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_CityLights_2012/default/500m/7/${row}/${column}.jpeg`,
  );
  assert(input, `National tile missing: ${row}/${column}`);
  return { input, left: (column - 135) * 512, top: (row - 21) * 512 };
});
await sharp({
  create: { width: 2048, height: 3072, channels: 3, background: '#020711' },
})
  .composite(national)
  .webp({ quality: 94 })
  .toFile(new URL('korea.webp', root).pathname);

const cities = [
  {
    id: 'temple',
    photo: 'ISS073-E-420107',
    longitude: 129.22,
    latitude: 35.86,
    nativeMeters: 9.56,
  },
  {
    id: 'jeju',
    photo: 'ISS070-E-69369',
    longitude: 126.53,
    latitude: 33.5,
    nativeMeters: 7.78,
  },
  {
    id: 'busan',
    photo: 'ISS066-E-158810',
    longitude: 129.08,
    latitude: 35.18,
    nativeMeters: 8,
  },
  {
    id: 'seoul',
    photo: 'ISS064-E-40609',
    longitude: 126.98,
    latitude: 37.57,
    nativeMeters: 11.62,
  },
  {
    id: 'yangyang',
    photo: 'ISS066-E-132137',
    longitude: 128.62,
    latitude: 38.08,
    nativeMeters: 53.16,
  },
];
const manifest = {
  national: {
    src: '/trip/night/korea.webp',
    west: 123.75,
    east: 132.75,
    north: 42.75,
    south: 29.25,
  },
  cities: {},
};
for (const city of cities) {
  if (city.id === 'yangyang') continue;
  const x = Math.floor(((city.longitude + 180) / 360) * 4096);
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan((city.latitude * Math.PI) / 180)) / Math.PI) /
      2) *
      4096,
  );
  const requests = [];
  for (let row = y - 4; row <= y + 4; row += 1) {
    for (let column = x - 4; column <= x + 4; column += 1)
      requests.push({ row, column });
  }
  const layers = await batch(requests, async ({ row, column }) => {
    const input = await download(
      `https://eol.jsc.nasa.gov/images/MapTiles/tiled_astronaut_photos/${city.photo}/12/${column}/${row}.png`,
    );
    return input
      ? { input, left: (column - x + 4) * 256, top: (row - y + 4) * 256 }
      : null;
  });
  assert(layers.length, `No geographic imagery for ${city.id}`);
  const composite = await sharp({
    create: { width: 2304, height: 2304, channels: 4, background: '#00000000' },
  })
    .composite(layers)
    .png()
    .toBuffer();
  // Feather only the geographic footprint; preserve observed streets at source resolution.
  const alpha = await sharp(composite)
    .extractChannel(3)
    .blur(32)
    .linear(2, -255)
    .raw()
    .toBuffer();
  const rgb = await sharp(composite).removeAlpha().linear(1.4).raw().toBuffer();
  await sharp(rgb, { raw: { width: 2304, height: 2304, channels: 3 } })
    .joinChannel(alpha, { raw: { width: 2304, height: 2304, channels: 1 } })
    .webp({ quality: 94 })
    .toFile(new URL(`${city.id}.webp`, root).pathname);
  assert(
    (await sharp(new URL(`${city.id}.webp`, root).pathname).metadata())
      .hasAlpha,
    `Source footprint alpha was lost for ${city.id}`,
  );
  manifest.cities[city.id] = {
    src: `/trip/night/${city.id}.webp`,
    photo: city.photo,
    west: ((x - 4) / 4096) * 360 - 180,
    east: ((x + 5) / 4096) * 360 - 180,
    north:
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y - 4)) / 4096))) * 180) /
      Math.PI,
    south:
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 5)) / 4096))) * 180) /
      Math.PI,
    nativeMeters: city.nativeMeters,
    credit: 'Earth Science and Remote Sensing Unit, NASA Johnson Space Center',
  };
  console.log(`${city.id}: ${layers.length} geographic tiles`);
}
// Reproject NASA's higher-resolution peninsula photo for the east-coast gap.
const original = await download(
  'https://eol.jsc.nasa.gov/DatabaseImages/ESC/large/ISS070/ISS070-E-80674.JPG',
);
assert(original, 'Missing peninsula photograph');
const { data: pixels, info } = await sharp(original)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const width = 1800,
  height = 1600;
const eastCoast = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const longitude = 127.7 + (x / width) * 1.8;
    const latitude = 38.7 - (y / height) * 1.6;
    // NASA mlcoord corners form an affine geographic footprint.
    const dx = longitude - 124.17,
      dy = latitude - 34.96;
    const determinant = 5.08 * 5.84 + 0.71 * 2.14;
    const u = (dx * 5.84 - dy * 2.14) / determinant;
    const v = (dy * 5.08 + dx * 0.71) / determinant;
    const sx = Math.round(u * (info.width - 1));
    const sy = Math.round(v * (info.height - 1));
    if (sx < 0 || sy < 0 || sx >= info.width || sy >= info.height) continue;
    const source = (sy * info.width + sx) * 3;
    const destination = (y * width + x) * 4;
    eastCoast[destination] = pixels[source];
    eastCoast[destination + 1] = pixels[source + 1];
    eastCoast[destination + 2] = pixels[source + 2];
    eastCoast[destination + 3] = 255;
  }
}
await sharp(eastCoast, { raw: { width, height, channels: 4 } })
  .webp({ quality: 94 })
  .toFile(new URL('yangyang.webp', root).pathname);
manifest.cities.yangyang = {
  src: '/trip/night/yangyang.webp',
  photo: 'ISS070-E-80674',
  west: 127.7,
  east: 129.5,
  north: 38.7,
  south: 37.1,
  nativeMeters: 122.63,
  credit: 'Earth Science and Remote Sensing Unit, NASA Johnson Space Center',
};
await writeFile(
  new URL('manifest.json', root),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
