> [!TIP]
> This repository hosts a friendly fork of the upstream [mymindstorm/setup-emsdk](https://github.com/mymindstorm/setup-emsdk) action. This repository is actively maintained by the Pyodide team and has been updated to support the latest GitHub Actions features.
>
>This repository shall be archived in the future once the upstream action comes back to maintenance and when mymindstorm/setup-emsdk#48 is merged.

> [!IMPORTANT]
> This fork is patched to avoid action-managed cache internals. If you want to persist the `actions-cache-folder` directory across workflow runs, cache that directory explicitly in your workflow with `actions/cache@v5`.

# setup-emsdk

This actions step downloads emsdk and installs a version of Emscripten.

## Usage

```yaml
name: "emsdk"
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: pyodide/setup-emsdk@v15

      - name: Verify
        run: emcc -v
```

## Cache

To just cache emsdk:

```yaml
- name: Setup emsdk
  uses: pyodide/setup-emsdk@v15
  with:
    # Make sure to set a version number!
    version: 1.38.40
    # This is the name of the cache folder.
    # The cache folder will be placed in the build directory,
    #  so make sure it doesn't conflict with anything!
    actions-cache-folder: 'emsdk-cache'

- name: Verify
  run: emcc -v
```

If you want to also cache system libraries generated during build time:

```yaml
env:
  EM_VERSION: 1.39.18
  EM_CACHE_FOLDER: 'emsdk-cache'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Setup cache
        id: cache-system-libraries
        uses: actions/cache@v5
        with:
          path: ${{env.EM_CACHE_FOLDER}}
          key: ${{env.EM_VERSION}}-${{ runner.os }}
      - uses: pyodide/setup-emsdk@v15
        with:
          version: ${{env.EM_VERSION}}
          actions-cache-folder: ${{env.EM_CACHE_FOLDER}}
      - name: Build library
        run: make -j2
      - name: Run unit tests
        run: make check
```

## Options

```yaml
version:
  description: 'Version to install'
  default: 'latest'
no-install:
  description: "If true will not download any version of Emscripten. emsdk will still be added to PATH."
  default: false
no-cache:
  description: "If true will not cache any downloads with tc.cacheDir."
  default: false
actions-cache-folder:
  description: "Directory to reuse/store emsdk in the workspace. Cache this folder externally with actions/cache if desired."
  default: ''
update:
  description: "Fetch package information for all the new tools and SDK versions"
  default: false
```

See [action.yml](action.yml)
