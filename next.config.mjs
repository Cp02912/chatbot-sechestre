/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // nu include în funcții fișiere inutile (date de test, scripturi)
  outputFileTracingExcludes: { "*": ["samples/**", "scripts/**", "README.md"] },
};
export default nextConfig;
