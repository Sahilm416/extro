# Extro

**Extro** is a developer-focused framework for building Chrome extensions with a modern stack and great DX.

The goal is to bring a **Next.js-like experience to Chrome extensions**:

* File-based entrypoints
* React support
* Automatic manifest generation
* Minimal configuration
* Clean build outputs
* Fast development workflow

---

# Current Features (MVP)

Extro currently supports:

### File-based extension entrypoints

Extro automatically detects extension entry files based on the project structure.

Example project:

```
popup/page.tsx
background/index.ts
content/index.ts
```

Detected entries:

```
popup → popup/page.tsx
background → background/index.ts
content → content/index.ts
```

No manual configuration required.

---

### Automatic Manifest Generation

Extro generates a **Manifest V3** file automatically.

Generated fields include:

* `action.default_popup`
* `background.service_worker`
* `content_scripts`
* `permissions`
* `host_permissions`

Example generated manifest:

```json
{
  "manifest_version": 3,
  "name": "Extro Extension",
  "version": "0.0.1",
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "host_permissions": ["<all_urls>"]
}
```

Developers do **not need to write a manifest manually**.

---

### Automatic Popup HTML Generation

Chrome extensions require an HTML file for popup UIs.

Extro automatically generates:

```
popup.html
```

Example generated file:

```html
<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
```

---

### Stable Build Output

Chrome extensions require deterministic filenames.

Extro produces:

```
dist/
  popup.html
  popup.js
  background.js
  content.js
  manifest.json
```

Instead of Vite's hashed assets.

---

### Vite Powered

Extro uses **Vite** internally for:

* fast builds
* module bundling
* modern JS support

---

# Repository Structure

The framework uses a **pnpm monorepo**.

```
extro/

packages/
  cli/
  core/
  react/
  vite-plugin/

examples/
  basic/

tsconfig.base.json
pnpm-workspace.yaml
```

---

# Packages

### `@extro/cli`

The command line interface.

Commands:

```
extro dev
extro build
extro init
```

Responsibilities:

* start Vite
* run Extro plugin
* build extensions

---

### `@extro/vite-plugin`

Handles most framework behavior:

* entry detection
* manifest generation
* popup HTML generation
* build configuration

---

### `@extro/core`

Core framework logic.

Future responsibilities:

* runtime utilities
* messaging helpers
* extension APIs

---

### `@extro/react`

React integration layer.

Future responsibilities:

* hooks
* extension providers
* routing

---

# Example Extension

Example project used for testing the framework:

```
examples/basic/

popup/
  page.tsx

background/
  index.ts

content/
  index.ts
```

Example popup:

```tsx
export default function Popup() {
  return <div>Hello from Extro</div>
}
```

---

# Development Workflow

Run the example extension:

```
cd examples/basic
extro dev
```

Build the extension:

```
extro build
```

Build output:

```
examples/basic/dist
```

Load in Chrome:

```
Chrome → Extensions → Load unpacked → dist/
```

---

# Architecture

Extro works like this:

```
CLI
 ↓
Vite Dev Server / Build
 ↓
Extro Vite Plugin
 ↓
Entry Detection
 ↓
Manifest Generation
 ↓
HTML Generation
 ↓
Extension Build
```

---

# Current Milestone

Extro can now:

* detect extension entrypoints
* generate a valid manifest
* generate popup HTML
* build a runnable Chrome extension
* produce Chrome-compatible output files

This forms the **minimal working Chrome extension framework**.

---

# Next Planned Features

Planned improvements:

* React auto-mount for popup pages
* Dev mode HMR
* Config file (`extro.config.ts`)
* Automatic icon detection
* Extension messaging helpers
* Storage utilities
* Better routing support
* Improved dev tools

---

# Vision

Extro aims to become:

**“Next.js for Chrome Extensions.”**

A framework where developers only need to write:

```
popup/page.tsx
background/index.ts
content/index.ts
```

and Extro handles everything else.
