# Vidi

Vidi is a tennis training visualization app evolving into a DApp. It turns tennis experience data into generative visual badges, and the planned Web3 layer allows each badge to be minted as an NFT.

The current app already supports local badge generation and collection. The badge system is designed as a blind-box style `Vidi Badge NFT` series: normal badges are generated from training metrics, while rare hidden variants use the rectangular ribbon-ring algorithm inspired by the local `rings.lua` generator.

## Vidi Badge NFT

`Vidi Badge NFT` is a generative-art badge system driven by tennis training data. Each badge is not a static image template. It is generated from session metrics, mint timestamp, and deterministic mapping rules.

Current rarity design:

| Type | Probability | Visual Structure |
| --- | ---: | --- |
| Regular Badge | 97.9% | Color ring background + thick black/white training curve |
| Hidden Badge | 2% | Full rectangular ribbon-ring badge |
| Pure Black Hidden Badge | 0.1% | Full rectangular ribbon-ring badge in pure black |

Regular badges use the colorful ring as the base layer. The foreground curve is rendered in black or white:

- Odd rounded average speed: white curve on black circular base.
- Even rounded average speed: black curve on white circular base.
- The ring itself stays colorful.

Hidden badges use the ring algorithm as the main artwork. The pure black hidden badge keeps the same ring geometry but forces the panels to black.

## Training Data Mapping

The badge generator maps training data into visual properties:

| Training Field | Badge Mapping |
| --- | --- |
| Training duration | Curve length, growth level, rotation, ring flow amount |
| Total shots | Stroke width, volume intensity, ring density |
| Average speed | Chooses the main curve family and black/white foreground color |
| Average apex height | Opacity and spatial disturbance strength |
| Peak heart rate | Highlight position along the generated path |
| System timestamp | SHA-256 seed for color palette, perturbation, and uniqueness |

The regular badge currently uses two main curve families:

- `Gosper 2D`: used for lower-speed sessions. It produces a continuous hexagonal space-filling path.
- `Z-order 3D`: used for higher-speed sessions. It projects a compact 3D Morton/Z-order curve into 2D.

Both curve families are layered above the colorful rectangular ring background. This creates a visual relationship similar to generative NFT collections: a structured base image with a data-derived foreground mark.

## Generative Rules

The visual generator is designed around three principles:

1. Data-driven: training metrics control structure instead of only filling text labels.
2. Unique: the system timestamp is hashed to introduce avalanche-style variation.
3. Collectible: rarity, visual family, and hidden variants can be represented as NFT metadata traits.

Example metadata traits for a future NFT:

```json
{
  "name": "Vidi Badge #1024",
  "attributes": [
    { "trait_type": "Badge Type", "value": "Regular" },
    { "trait_type": "Curve Family", "value": "Gosper 2D" },
    { "trait_type": "Foreground", "value": "White" },
    { "trait_type": "Ring Layer", "value": "Color Ribbon" },
    { "trait_type": "Duration Band", "value": "60-90 min" }
  ]
}
```

## DApp Direction

The planned DApp flow:

1. Generate a badge from tennis training data.
2. Preview the artwork locally.
3. Connect a wallet.
4. Serialize badge traits and media metadata.
5. Mint the badge as an NFT.
6. Display it in a marketplace such as OpenSea.

Raw training data should not be published directly. The DApp should expose normalized traits, artwork, algorithm version, and a proof hash when needed.

## Development

Install dependencies and run the frontend build:

```bash
npm install
npm run build
```

Check the Tauri/Rust side:

```bash
cd src-tauri
cargo check
```

Run the app in development:

```bash
npm run tauri dev
```

Build the desktop app:

```bash
npm run tauri build
```
