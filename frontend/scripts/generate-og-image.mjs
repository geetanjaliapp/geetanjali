#!/usr/bin/env node
/**
 * Generate Open Graph social share image (1200x630px)
 * Run: node scripts/generate-og-image.mjs
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIDTH = 1200;
const HEIGHT = 630;

// Brand colors
const ORANGE_600 = '#EA580C';
const ORANGE_50 = '#FFF7ED';
const GRAY_800 = '#1F2937';

async function generateOgImage() {
  // Create SVG with branded background, logo placeholder, and text
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${ORANGE_50};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FED7AA;stop-opacity:1" />
        </linearGradient>
        <!-- Decorative pattern -->
        <pattern id="lotus" patternUnits="userSpaceOnUse" width="120" height="120">
          <circle cx="60" cy="60" r="4" fill="${ORANGE_600}" opacity="0.08"/>
        </pattern>
      </defs>

      <!-- Background gradient -->
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

      <!-- Subtle pattern overlay -->
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#lotus)"/>

      <!-- Decorative accent line -->
      <rect x="100" y="${HEIGHT - 80}" width="200" height="4" rx="2" fill="${ORANGE_600}" opacity="0.6"/>

      <!-- App name -->
      <text x="600" y="280"
            font-family="Georgia, serif"
            font-size="72"
            font-weight="bold"
            fill="${GRAY_800}"
            text-anchor="middle">
        Geetanjali
      </text>

      <!-- Tagline -->
      <text x="600" y="360"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="32"
            fill="#57534E"
            text-anchor="middle">
        Ethical Guidance from the Bhagavad Gita
      </text>

      <!-- Subtitle -->
      <text x="600" y="420"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="24"
            fill="#78716C"
            text-anchor="middle">
        Timeless wisdom for life's difficult decisions
      </text>

      <!-- Bottom accent -->
      <rect x="0" y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="${ORANGE_600}"/>
    </svg>
  `;

  // Read the logo SVG and resize it
  const logoPath = join(__dirname, '../public/logo.svg');
  const logoSvg = readFileSync(logoPath, 'utf-8');

  // Create logo as PNG (200x200)
  const logoPng = await sharp(Buffer.from(logoSvg))
    .resize(160, 160)
    .png()
    .toBuffer();

  // Create background from SVG
  const background = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  // Composite logo onto background
  const finalImage = await sharp(background)
    .composite([
      {
        input: logoPng,
        top: 80,  // Position from top
        left: Math.floor((WIDTH - 160) / 2),  // Center horizontally
      }
    ])
    .png({ quality: 90 })
    .toBuffer();

  // Save to public folder
  const outputPath = join(__dirname, '../public/og-image.png');
  writeFileSync(outputPath, finalImage);

  console.log(`✓ Generated OG image: ${outputPath}`);
  console.log(`  Dimensions: ${WIDTH}x${HEIGHT}px`);
}

generateOgImage().catch(console.error);
