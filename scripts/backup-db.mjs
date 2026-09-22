import assert from 'node:assert/strict'
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import mysql from 'mysql2/promise'

const root = fileURLToPath(new URL('../', import.meta.url))
const target = new URL(process.env.DATABASE_URL)
assert(target.hostname === '127.0.0.1' && target.port === '3317' && target.pathname === '/onion', 'This backup command only reads the local Onion database on port 3317.')
const binary = process.env.MYSQLDUMP_PATH || join(dirname(process.env.MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe'), 'mysqldump.exe')
await access(binary)
const createdAt = new Date()
const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(createdAt).replace(' ', '_').replaceAll(':', '-')
const destination = resolve(root, 'backups', `onion-${stamp}-${createdAt.getMilliseconds()}`)
await mkdir(resolve(root, 'backups'), { recursive: true })
await mkdir(destination)
await mkdir(resolve(root, '.runtime'), { recursive: true })
const clientFile = resolve(root, '.runtime', `backup-client-${randomUUID()}.cnf`)
const quote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r')}"`
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const db = await mysql.createConnection(process.env.DATABASE_URL)
try {
  const [[identity]] = await db.query('SELECT DATABASE() AS name,@@port AS port,@@version AS version')
  assert(identity.name === 'onion' && +identity.port === 3317)
  const [tables] = await db.query('SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME')
  assert(tables.every(table => table.engine === 'InnoDB'), 'Consistent online backup requires InnoDB tables.')
  await writeFile(clientFile, `[client]\nhost=127.0.0.1\nport=3317\nprotocol=tcp\nuser=${quote(decodeURIComponent(target.username))}\npassword=${quote(decodeURIComponent(target.password))}\n`, { flag: 'wx', mode: 0o600 })
  const partial = join(destination, 'database.sql.partial')
  await promisify(execFile)(binary, [
    `--defaults-extra-file=${clientFile}`, '--single-transaction', '--quick', '--skip-lock-tables',
    '--no-tablespaces', '--set-gtid-purged=OFF', '--hex-blob', '--routines', '--events', '--triggers',
    '--default-character-set=utf8mb4', '--column-statistics=0', `--result-file=${partial}`, 'onion',
  ], { windowsHide: true, maxBuffer: 1024 * 1024 })
  const sql = await readFile(partial)
  const sqlText = sql.toString('utf8')
  assert(sqlText.includes('-- Dump completed on '), 'Incomplete SQL export')
  for (const table of tables) assert(sqlText.includes(`CREATE TABLE \`${table.name}\``), `Missing table: ${table.name}`)
  await rename(partial, join(destination, 'database.sql'))
  const uploadRoot = resolve(root, process.env.UPLOAD_DIR || 'data/uploads')
  const files = []
  async function copyUploads(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = join(directory, entry.name)
      assert(!entry.isSymbolicLink(), 'Upload backups do not follow symbolic links')
      if (entry.isDirectory()) await copyUploads(source)
      else if (entry.isFile()) {
        const path = relative(uploadRoot, source).replaceAll('\\', '/')
        const output = join(destination, 'uploads', path)
        await mkdir(dirname(output), { recursive: true })
        await copyFile(source, output)
        const original = await readFile(source), copied = await readFile(output)
        assert.equal(hash(original), hash(copied), `Upload copy differs: ${path}`)
        files.push({ path, bytes: copied.length, sha256: hash(copied) })
      }
    }
  }
  await mkdir(join(destination, 'uploads'))
  await copyUploads(uploadRoot)
  const [media] = await db.query('SELECT relative_path AS path,sha256,size FROM media_assets')
  for (const asset of media) {
    const file = files.find(file => file.path === asset.path.replaceAll('\\', '/'))
    assert(file && file.sha256 === asset.sha256 && file.bytes === asset.size, `Media backup missing or changed: ${asset.path}`)
  }
  const [content] = await db.query('SELECT kind,COUNT(*) AS count FROM content_items WHERE archived_at IS NULL GROUP BY kind')
  const manifest = { completed: true, createdAt: createdAt.toISOString(), timezone: 'Asia/Shanghai', database: identity, consistency: 'mysqldump --single-transaction (InnoDB)', tables: tables.map(table => table.name), contentCountsAfterExport: content, sql: { path: 'database.sql', bytes: sql.length, sha256: hash(sql) }, uploads: files }
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await writeFile(join(destination, 'README.md'), `# Onion 本地完整备份\n\n备份时间：${stamp}（北京时间）。\n\n- database.sql：全部 ${tables.length} 张表的结构和数据，包括管理员账号、内容版本、评论、站点设置和中英文文案。\n- uploads/：${files.length} 个原始上传文件。\n- manifest.json：SQL 与图片文件的大小、SHA-256，以及表清单。\n\n## 恢复\n\n1. 新建一个空的 MySQL 8 数据库，字符集使用 utf8mb4。\n2. 使用 MySQL 客户端将 database.sql 导入该空库（文件不包含 CREATE DATABASE / USE，可选择目标库）。例如在 mysql 客户端选中目标数据库后运行 SOURCE D:/完整路径/database.sql;。\n3. 将 uploads/ 内的内容复制到网站 UPLOAD_DIR 指定的目录，保留相对路径。\n4. 在部署环境单独配置 DATABASE_URL 和原来的站点环境变量，再启动网站。\n\n此备份没有执行恢复，也没有修改正在运行的数据库。数据库服务账号及 .env 未打包；网站管理员账号的密码哈希包含在 SQL 中。备份保存在本地，已排除 Git 和 Docker 构建。\n`)
  console.log(JSON.stringify({ directory: destination, tables: tables.length, sqlBytes: sql.length, uploads: files.length, uploadBytes: files.reduce((sum, file) => sum + file.bytes, 0), content, verified: true }, null, 2))
} finally {
  await db.end()
  await rm(clientFile, { force: true })
}
