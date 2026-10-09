# NestJS Service Manager — v01

A Cursor / VS Code extension that discovers NestJS applications from `nest-cli.json`, runs them in separate terminals, and displays their process status in a draggable Webview View.

**Release label:** v01. **Extension version:** `0.1.0` (npm/VS Code require semantic versioning).

## Display behavior

- **Active:** each running microservice retains its green left accent and subtle green row background. Two running services show two Active markers.
- **Selected:** the service currently selected for logs keeps a separate outline.
- **Hover:** the row under the mouse receives a temporary hover background without clearing Active or Selected on other services.
- Play/Stop is clickable **only on the left icon**; clicking the service name opens its terminal if it is running.
- Terminal and Restart remain on the right of running services.
- White toolbar icons: Refresh, Start All (ListVideo), Stop All (ListX). There is **no Restart All**.

The interface uses Lucide icons and Morphicons for Run ↔ Stop and scanning animations. Scanning `nest-cli.json` can show a loading animation, and no-result/error states offer guidance to Refresh or Open Folder. Missing or failed browser bundles display an error instead of a silent empty panel.

## Setup and run

1. Extract this ZIP, open the **`nestjs-service-manager-v01`** directory in Cursor.
2. In the extension project terminal, run:

   ```bash
   npm install
   npm run compile
   npm test
   ```

   The first install needs npm registry access. Compilation must generate `media/webview.bundle.js`. This generated browser bundle is not included in the source ZIP.
3. Press **F5**, then open your NestJS backend workspace (e.g. `memora-backend`) inside Extension Development Host.
4. Open **NestJS Services** in the sidebar (or Explorer), and drag the **view header** to the *side* of the Terminal panel to display logs beside the service list.

The workspace must be trusted and the backend must have a locally installed Nest CLI. The extension identifies Nest CLI apps through `nest-cli.json` and excludes libraries.

## Package as VSIX

```bash
npm run package:vsix
```

Install from Cursor → Extensions → `...` → Install from VSIX. Run `npm install && npm run compile` before packaging.

## Source layout

```text
nestjs-service-manager-v01/
├── .vscode/launch.json
├── .vscodeignore
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
├── media/
│   └── webview.js             # Lucide + Morphicons UI, bundles on compile
├── resources/
├── src/
│   ├── discovery.ts           # Workspace discovery
│   ├── parser.ts              # Nest CLI config parser
│   ├── terminal.ts            # Process + terminal management
│   ├── servicesWebview.ts     # Webview + styles
│   └── extension.ts           # Activation + commands
├── dist/                      # Precompiled extension host JS
└── test/                      # Node.js tests
```

The Webview and morph animation should be validated inside Cursor after installation and compilation; the automated tests cover host commands, discovery, UI configuration, and process management, not full graphical interaction.
