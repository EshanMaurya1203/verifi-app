import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Verifii - Verified Startup Revenue for Indian Founders',
    short_name: 'Verifii',
    description: 'Verifii is a platform for Indian founders to verify their startup revenue via payment provider APIs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#b9ff4b',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
