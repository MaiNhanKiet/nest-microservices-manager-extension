# NestJS Service Manager

Discover NestJS applications from `nest-cli.json`, then run, stop, restart, and open their logs from a Cursor / VS Code sidebar.

The service list lives in a Webview view. Drag its header next to the Terminal panel if you want the list and logs side by side.

Source: [MaiNhanKiet/nest-microservices-manager-extension](https://github.com/MaiNhanKiet/nest-microservices-manager-extension)

## What you can do

- Finds Nest CLI **applications** in the workspace and skips libraries.
- **Play / Stop** is the icon on the left of a row. Clicking the service name does not start or stop it.
- Clicking a **running** service name opens that service's terminal.
- **Logs** and **Restart** appear on the right when you hover a running service.
- Toolbar actions: **Refresh**, **Start All**, **Stop All**.
- The row you select gets a light green background. Running and stopped services are told apart by the play and stop icons.
- If the workspace has no NestJS applications, the panel shows **No NestJS services found**, with **Refresh** and **Open Folder**.

The workspace must be trusted. The backend folder needs a locally installed Nest CLI (`nest-cli.json` plus `node_modules`).

### Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `nestjsServices.nodePath` | `node` | Node.js executable used to start the local Nest CLI |
| `nestjsServices.watch` | `true` | Pass `--watch` to `nest start` |

## Build the VSIX

These commands create the file you upload to the Marketplace. Run them from this extension folder.

Requirements: Node.js 20 or newer, and npm.

```bash
npm install
npm test
npm run package:vsix
```

`npm test` compiles first. `package:vsix` compiles again, bundles `media/webview.bundle.js`, and writes:

```text
nestjs-service-manager-0.1.0.vsix
```

The version in the filename comes from `version` in `package.json`. The VSIX does not include `node_modules`. Lucide and Morphicons are already inside `media/webview.bundle.js`.

Install the same file locally to check it before upload:

1. Cursor or VS Code → Extensions → `...` → **Install from VSIX...**
2. Choose the `.vsix` file.
3. Open a trusted NestJS backend folder and confirm the **NestJS Services** view lists the applications.

## Publish to the Marketplace

Do this once, before the first upload.

1. Create a publisher at [Visual Studio Marketplace](https://aka.ms/vscode-create-publisher). The publisher id is the short name, not the display name.
2. `package.json` already uses publisher id `kietmn`, which matches this Marketplace account.
3. Bump `"version"` for every later upload. The Marketplace rejects a version that was already published.
4. Run `npm run package:vsix` again so the VSIX picks up the publisher and version.

`repository` in `package.json` already points at [nest-microservices-manager-extension](https://github.com/MaiNhanKiet/nest-microservices-manager-extension). The Marketplace uses that link for the repository button. The README shown on the Marketplace comes from this VSIX, not from the GitHub page.

Upload the new `.vsix` at [Manage Extensions](https://marketplace.visualstudio.com/manage) → **New extension** → **Visual Studio Code** → upload the file.

To publish from the terminal instead of the website:

```bash
npx vsce login <publisher-id>
npx vsce publish
```

`vsce login` asks for a Personal Access Token from Azure DevOps with the **Marketplace (manage)** scope.

## Source layout

```text
nestjs-service-manager-v01/
├── package.json
├── src/                 # Extension host (compiled to dist/)
├── media/webview.js     # Sidebar UI source
├── media/webview.bundle.js
├── resources/
├── test/
└── dist/                # Compiled extension, produced by npm run compile
```
