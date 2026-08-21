import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08665C',
        borderRadius: 7,
      }}
    >
      <svg width="23" height="23" viewBox="0 0 256 256">
        <path
          d="M128 70c-48.5 0-87 28.5-87 64.5 0 15.8 7.4 30.4 20.1 41.8l-5.8 26.2c-1.1 5 3.8 8.9 8.4 6.4l28.2-15.4c10.9 3.8 23.2 5.5 36.1 5.5 48.5 0 87-28.5 87-64.5S176.5 70 128 70Z"
          fill="#25D366"
        />
      </svg>
    </div>,
    { ...size }
  );
}
