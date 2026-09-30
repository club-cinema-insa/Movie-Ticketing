/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    domains: ["cdn.discordapp.com", "lh3.googleusercontent.com"],
  },

  reactStrictMode: true,

  // pdfkit lit ses polices (.afm) sur le disque : il doit rester un paquet externe
  // pour que Vercel embarque ses fichiers de données dans la fonction.
  serverExternalPackages: ["pdfkit"],

  // Logos de /public et polices du billet, lus par le générateur (fs) : à inclure explicitement.
  outputFileTracingIncludes: {
    "/api/events/[id]/register": ["./public/*.png", "./src/server/fonts/*"],
  },
};

export default config;
