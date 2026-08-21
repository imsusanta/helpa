import { ImageResponse } from 'next/og';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const iconBuffer = fs.readFileSync(
    path.join(process.cwd(), 'public', 'favicon-32x32.png')
  );
  const base64 = `data:image/png;base64,${iconBuffer.toString('base64')}`;

  return new ImageResponse(
    <img
      src={base64}
      alt="Helpa logo"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 7,
        objectFit: 'cover',
      }}
    />,
    { ...size }
  );
}
