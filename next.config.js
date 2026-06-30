/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'google-play-scraper',
      'app-store-scraper',
      'googleapis',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        'google-play-scraper',
        'app-store-scraper',
        'googleapis'
      )
    }
    return config
  },
}

module.exports = nextConfig
