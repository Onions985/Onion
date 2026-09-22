import { isIP } from 'node:net'
import { getHeader, type H3Event } from 'h3'
export function clientIp(event: H3Event) {
  const forwarded = process.env.TRUST_PROXY === 'true' ? getHeader(event, 'x-real-ip') : undefined
  return forwarded && isIP(forwarded) ? forwarded : event.node.req.socket.remoteAddress || 'local'
}
