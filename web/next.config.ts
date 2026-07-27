import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Emits a self-contained server bundle for the Docker runner stage.
    output: "standalone",
};

export default nextConfig;
