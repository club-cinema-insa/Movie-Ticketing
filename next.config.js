/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,

  async redirects() {
    return [{ source: "/", destination: "/events", permanent: false }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La caméra ne sert qu'au scanner du bureau.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  // pdfkit lit ses polices (.afm) sur le disque : il doit rester un paquet externe
  // pour que Vercel embarque ses fichiers de données dans la fonction.
  serverExternalPackages: ["pdfkit"],

  // Logos de /public et polices du billet, lus par le générateur (fs) : à inclure explicitement.
  outputFileTracingIncludes: {
    "/api/events/[id]/register": ["./public/*.png", "./src/server/fonts/*"],
    "/api/tickets/[code]/pdf": ["./public/*.png", "./src/server/fonts/*"],
  },
};

export default config;
