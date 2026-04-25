#!/usr/bin/env node
/**
 * Run the Tauri desktop binary after `tauri build --no-bundle` (cross-platform).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ext = process.platform === 'win32' ? '.exe' : ''
const bin = path.join(root, 'src-tauri', 'target', 'release', `llamastudio-desktop${ext}`)

if (!existsSync(bin)) {
  console.error(`[run-desktop-release] Binary not found: ${bin}`)
  process.exit(1)
}

const child = spawn(bin, process.argv.slice(2), {
  stdio: 'inherit',
  cwd: root,
})
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
