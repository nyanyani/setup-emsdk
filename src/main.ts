import { addPath, exportVariable, getInput, setFailed, warning } from "@actions/core"
import * as exec from "@actions/exec"
import * as tc from "@actions/tool-cache"
import * as io from "@actions/io"
import * as os from "node:os"
import * as fs from "node:fs"
import * as path from "node:path"
import { envRegex, pathRegex } from "./matchers.js"

function getManagedEmsdkFolder(folder: string) {
  return path.join(folder, "emsdk-main")
}

function hasManagedEmsdk(folder: string) {
  const emsdkScript =
    os.platform() === "win32"
      ? path.join(getManagedEmsdkFolder(folder), "emsdk.ps1")
      : path.join(getManagedEmsdkFolder(folder), "emsdk")

  return fs.existsSync(emsdkScript)
}

async function run() {
  try {
    const [version, noInstall, noCache, actionsCacheFolder, cacheKey, updateFlag] = await Promise.all([
      getInput("version"),
      getInput("no-install"),
      getInput("no-cache"),
      getInput("actions-cache-folder"),
      getInput("cache-key"),
      getInput("update"),
    ])

    // XXX: update-tags is deprecated and used for backwards compatibility.
    const update = updateFlag || (await getInput("update-tags"))

    let emsdkFolder: string | undefined
    let foundInCache = false
    const workspaceFolder = process.env.GITHUB_WORKSPACE
    const managedFolder = actionsCacheFolder && workspaceFolder ? path.join(workspaceFolder, actionsCacheFolder) : null

    if (version !== "latest" && version !== "tot" && noCache === "false" && !actionsCacheFolder) {
      emsdkFolder = await tc.find("emsdk", version, os.arch())
    }

    if (cacheKey) {
      warning("cache-key is deprecated and ignored. Manage cache keys in your workflow cache step instead.")
    }

    if (managedFolder) {
      if (hasManagedEmsdk(managedFolder)) {
        emsdkFolder = managedFolder
        foundInCache = true
      } else {
        warning(
          `No emsdk installation found at path "${managedFolder}". Downloading a fresh copy; cache this folder externally if you want reuse across runs.`
        )
        await io.rmRF(managedFolder)
      }
    }

    if (!emsdkFolder) {
      const emsdkArchive = await tc.downloadTool("https://github.com/emscripten-core/emsdk/archive/main.zip")
      emsdkFolder = await tc.extractZip(emsdkArchive)
    } else if (!foundInCache) {
      foundInCache = true
    }

    if (!emsdkFolder) {
      throw new Error("Failed to determine the emsdk folder")
    }

    let emsdkRoot = getManagedEmsdkFolder(emsdkFolder)
    let emsdk = path.join(emsdkRoot, "emsdk")

    if (os.platform() === "win32") {
      emsdk = `powershell ${path.join(emsdkRoot, "emsdk.ps1")}`
    }

    if (noInstall === "true") {
      if (managedFolder && !foundInCache) {
        fs.mkdirSync(managedFolder, { recursive: true })
        await io.cp(emsdkRoot, getManagedEmsdkFolder(managedFolder), { recursive: true })
        emsdkFolder = managedFolder
        emsdkRoot = getManagedEmsdkFolder(managedFolder)
      }

      addPath(emsdkRoot)
      exportVariable("EMSDK", emsdkRoot)
      return
    }

    if (!foundInCache) {
      if (update) {
        await exec.exec(`${emsdk} update`)
      }

      await exec.exec(`${emsdk} install ${version}`)

      if (version !== "latest" && version !== "tot" && noCache === "false" && !actionsCacheFolder) {
        await tc.cacheDir(emsdkFolder, "emsdk", version, os.arch())
      }

      if (managedFolder) {
        fs.mkdirSync(managedFolder, { recursive: true })
        await io.cp(emsdkRoot, getManagedEmsdkFolder(managedFolder), { recursive: true })
        emsdkFolder = managedFolder
        emsdkRoot = getManagedEmsdkFolder(managedFolder)
        emsdk =
          os.platform() === "win32" ? `powershell ${path.join(emsdkRoot, "emsdk.ps1")}` : path.join(emsdkRoot, "emsdk")
      }
    }

    await exec.exec(`${emsdk} activate ${version}`)
    const envListener = (message: string) => {
      const pathResult = pathRegex.exec(message)

      if (pathResult) {
        addPath(pathResult[1])
        return
      }

      const envResult = envRegex.exec(message)

      if (envResult) {
        exportVariable(envResult[1], envResult[2])
        return
      }
    }
    await exec.exec(`${emsdk} construct_env`, [], { listeners: { stdline: envListener, errline: envListener } })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      (typeof error.message === "string" || error.message instanceof Error)
    ) {
      setFailed(error.message)
    }
  }
}

run()
