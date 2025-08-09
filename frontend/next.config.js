/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Désactiver Turbopack si besoin
  experimental: {
    // laisser vide ou ne pas mettre lightningcss ici
  }
};

module.exports = nextConfig;
