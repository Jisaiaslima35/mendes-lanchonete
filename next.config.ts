import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acessar o dev server pelo IP da VPS (156.67.31.108:3000) além do localhost.
  // Sem isto, Next 16 bloqueia o HMR cross-origin e o client JS não inicializa direito.
  allowedDevOrigins: ["156.67.31.108", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hdiuqdwlhcmzfhnkirfw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
