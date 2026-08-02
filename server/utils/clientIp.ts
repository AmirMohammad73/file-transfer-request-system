import { Request } from 'express';

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  if (trimmed === '::1') {
    return '127.0.0.1';
  }
  return trimmed;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return normalizeIp(forwarded.split(',')[0]);
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0]);
  }
  const socketIp = req.socket?.remoteAddress || req.ip || '';
  return normalizeIp(socketIp);
}

export function ipsMatch(ipA: string, ipB: string): boolean {
  return normalizeIp(ipA) === normalizeIp(ipB);
}
