import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
const state = JSON.parse(await readFile('.runtime/mysql/local-state.json', 'utf8'))
const db = await mysql.createConnection({
  host: '127.0.0.1',
  port: state.port,
  user: 'root',
  password: state.rootPassword,
})
try {
  await db.query('SHUTDOWN')
  console.log('Project MySQL stopped. Data was preserved.')
} finally {
  await db.end()
}
