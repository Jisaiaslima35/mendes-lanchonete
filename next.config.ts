import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acessar o dev server pelo IP da VPS (156.67.31.108:3000) além do localhost.
  // Sem isto, Next 16 bloqueia o HMR cross-origin e o client JS não inicializa direito.
  allowedDevOrigins: ["156.67.31.108", "localhost"],
  images: {
    remotePatterns: [
      {
        // Bucket `midia` do Supabase Cloud do Mendes.
        // O hostname antigo (hdiuqdwlhcmzfhnkirfw) era de OUTRO projeto
        // e causava erro 400 no Next Image Optimization. Sem isto, as
        // fotos de produto no admin ficam com preview quebrado.
        protocol: "https",
        hostname: "pxqyznkqbvdijdcadkum.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  // Anti-cache de HTML / Server Actions / RSC.
  // Sem isso, Cloudflare CDN pode devolver HTML/RSC de um BUILD_ID antigo
  // após um redeploy, e o client manda Server Action IDs novos que o server
  // não reconhece → "Server Reference ID did not match the expected format".
  // Mantemos cache em assets estáticos (/_next/static, /_next/image, imagens).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
