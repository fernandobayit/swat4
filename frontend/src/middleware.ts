import { NextResponse } from 'next/server';

// Proxy /api/* em RUNTIME (por request) para o backend definido via
// environment do container (API_URL). Motivo: rewrites em next.config.js
// sao capturados no `next build` (routes-manifest) e ignoram env definida
// apenas em runtime — o middleware roda em runtime e permite que cada host
// aponte para o seu proprio backend sem precisar de imagem dedicada.
export function middleware(req: Request) {
    const url = new URL(req.url);
    const backend = process.env.API_URL || 'http://backend:8000';
    const target = `${backend.replace(/\/$/, '')}${url.pathname}${url.search}`;
    return NextResponse.rewrite(target);
}

export const config = {
    matcher: '/api/:path*',
};
