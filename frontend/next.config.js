/** @type {import('next').NextConfig} */
// O proxy de /api/* para o backend acontecia via rewrites aqui — capturados
// no `next build` (routes-manifest) e portanto imunes a env definida apenas
// em runtime. Agora o proxy vive no middleware (src/middleware.ts), que roda
// por request e respeita API_URL definida no container de cada host.
const nextConfig = {};

module.exports = nextConfig;
