import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt:${salt}:${hash.toString('hex')}`
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, digest] = stored.split(':')
  if (algorithm !== 'scrypt' || !salt || !digest || !/^[a-f0-9]{128}$/.test(digest)) return false
  const actual = (await scrypt(password, salt, 64)) as Buffer
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'))
}
