import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise'
import { createError } from 'h3'

let pool: Pool | undefined
export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw createError({ statusCode: 503, statusMessage: 'DATABASE_NOT_CONFIGURED' })
    const url = new URL(process.env.DATABASE_URL)
    if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must use MySQL')
    pool = mysql.createPool({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      connectionLimit: 8,
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true,
      ...(process.env.DATABASE_SSL === 'true' ? { ssl: {} } : {}),
    })
  }
  return pool
}
type Connection = Pool | PoolConnection
type SqlValue = string | number | boolean | null | Date | Buffer
export async function query<T>(
  sql: string,
  params: SqlValue[] = [],
  connection: Connection = getPool(),
): Promise<T[]> {
  const [rows] = await connection.execute<RowDataPacket[]>(sql, params)
  return rows as T[]
}
export async function execute(sql: string, params: SqlValue[] = [], connection: Connection = getPool()) {
  const [result] = await connection.execute<ResultSetHeader>(sql, params)
  return result
}
export async function transaction<T>(action: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await action(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
export function jsonValue<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T
}
