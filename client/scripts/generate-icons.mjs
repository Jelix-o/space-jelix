import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6d35f6"/>
      <stop offset="100%" stop-color="#9c5cff"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="10" fill="url(#g)"/>
  <text x="24" y="35" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="30" font-weight="900" fill="#fff">J</text>
</svg>`

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

const resDir = path.resolve('android/app/src/main/res')

for (const [folder, size] of Object.entries(sizes)) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const dir = path.join(resDir, folder)
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const filePath = path.join(dir, name)
    if (fs.existsSync(dir)) {
      fs.writeFileSync(filePath, pngBuffer)
      console.log(`Generated ${filePath} (${size}x${size})`)
    }
  }
}

console.log('Done!')
