import { chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import path from "node:path"

import ncc from "@vercel/ncc"

const workspaceRoot = process.cwd()
const inputFile = path.join(workspaceRoot, "src", "main.ts")
const outDir = path.join(workspaceRoot, "dist")

async function writeAsset(filePath, asset) {
  await mkdir(path.dirname(filePath), { recursive: true })

  if (asset.symlinks?.length) {
    const symlinkTarget = asset.symlinks[0]
    await symlink(symlinkTarget, filePath)
    return
  }

  const source = typeof asset.source === "function" ? await asset.source() : asset.source
  await writeFile(filePath, source)

  if (asset.permissions) {
    await chmod(filePath, asset.permissions)
  }
}

async function build() {
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const { code, assets } = await ncc(inputFile, {
    externals: ["os", "fs", "path"],
    license: "licenses.txt",
    minify: false,
    sourceMap: false,
    target: "es2022",
  })

  await writeFile(path.join(outDir, "index.js"), code)

  await Promise.all(
    Object.entries(assets).map(([assetPath, asset]) => writeAsset(path.join(outDir, assetPath), asset)),
  )

  await writeFile(path.join(outDir, "package.json"), `${JSON.stringify({ type: "module" }, null, 2)}\n`)
}

build().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
