# Seoul closeup night lights

`public/trip/seoul-lights.json` is a separate, offline **12,000-point** decorative field for the Seoul closeup. It leaves the existing 12,492-point national field unchanged. The renderer can upload `lights` directly through the existing geographic point shader: each entry contains WGS84 `longitude`, `latitude`, and independent `brightness` and `size` multipliers.

The source is the prepared `seoul-geography.json` city boundary and Han River water geometry, documented in [SEOUL_GEOGRAPHY.md](SEOUL_GEOGRAPHY.md). Boundary rings and water/island rings use even-odd containment. Candidates outside Seoul or in actual river water are rejected; mapped islands, including Yeouido, remain dry and lit. The source credits and separate SGIS/vuski and OpenStreetMap license notices are retained in the point asset. Keep the existing linked map attribution when showing this layer.

These are synthesized lights, **not satellite luminosity, population, building positions, surveyed terrain, or route geometry**. Gangnam, Jongno and six other hub anchors use the existing sourced area/station labels. Additional broad urban footprints and the Bukhansan, Gwanaksan and Namsan attenuation masks are approximate visual weights. No new geocoding or network service is used.

## Distribution

Uniform continuous random candidates are weighted by overlapping, smooth urban footprints and a quieter background. Gangnam and Jongno receive the strongest individual weights; Hongdae, Yeouido, Jamsil, Seongsu and other residential/commercial areas remain populated. The approximate mountains taper down smoothly rather than cutting geometric holes.

An approximately 39-metre minimum separation rejects unusually close pairs. A spatial hash accelerates this check but never sets point positions: no point is snapped to a lattice, a coast, a road or a ring. Independent seeded brightness (`0.18–0.95`) and size (`0.45–1.35`, biased small) keep dense areas distinct. The local shader should use modest sprite size/opacity rather than a large additive bloom, so the increased count does not become a white mass.

Counts within approximately 1.3 km of the sourced hub anchors:

| Area | Lights | Mean brightness multiplier |
| --- | ---: | ---: |
| Gangnam | 250 | 0.563 |
| Jongno | 247 | 0.583 |
| Hongdae | 165 | 0.535 |
| Yeouido | 242 | 0.553 |
| Jamsil | 169 | 0.529 |
| Seongsu | 158 | 0.509 |
| Seoul Station | 222 | 0.591 |
| Guro | 140 | 0.531 |
| Gangseo | 139 | 0.526 |
| Nowon | 121 | 0.562 |
| Eunpyeong | 103 | 0.525 |
| Gangdong | 132 | 0.531 |
| Jungnang | 137 | 0.522 |

The equivalent Bukhansan and Gwanaksan probes contain five and three lights. The brightest individual weights do not imply an exact ranking of every overlapping probe; river masks and adjacent urban footprints also affect local counts.

## Regeneration and checks

```sh
node scripts/prepare-seoul-lights.mjs
node --test tests/seoul-lights.test.mjs
```

The producer uses Node's standard library and the already prepared local Seoul geography. Seed `0x20261116` produces exactly 12,000 points in 194,128 attempts. The asset is **1,440,511 bytes**; SHA-256 is `77abb77a2b61e3715340ee5e5e9983e9f3647fcf77752dd6eec1e20c11e4a169`. Repeating the producer produced the identical digest.

Four focused tests cover the bounded point payload, finite in-bounds point attributes, unique positions, actual city/water/island containment, stronger Gangnam/Jongno density, secondary neighborhood coverage, soft mountain suppression, brightness/size variation and non-lattice coordinate phases. The busiest 0.005° cell contains 17 points. First-slice verification started with a failing missing-asset test, then generated the field through the producer.

The integrating renderer owns screen-level density, camera fade, resource cleanup and GPU/CPU checks. Asset validation alone does not establish motion performance or final on-screen brightness.
