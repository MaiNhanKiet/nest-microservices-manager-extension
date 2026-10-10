# NestJS Microservices Manager

Discover NestJS applications from `nest-cli.json`, then run, stop, restart, and open their logs from the Cursor or VS Code sidebar.

The service list is a view you can drag next to the Terminal panel, so the list and the logs sit side by side.

## Install

Search for **NestJS Microservices Manager** in the Extensions view, or install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=kietmn.nestjs-microservices-manager).

## Features

- Finds Nest CLI applications in the workspace and skips libraries.
- **Play / Stop** is the icon on the left of a row. Clicking the service name does not start or stop it.
- Clicking a running service name opens that service's terminal.
- **Logs** and **Restart** appear on the right when you hover a running service.
- Toolbar actions: **Refresh**, **Start All**, and **Stop All**.
- The selected row has a light green background. A play icon means stopped, and a stop icon means running.
- If nothing is found, the panel shows **No NestJS services found**, with **Refresh** and **Open Folder**.

## Requirements

- A trusted workspace. Starting a service runs code from that folder.
- A NestJS backend with `nest-cli.json` and the Nest CLI installed in that project (`npm install` in the backend).

Open **NestJS Services** from the activity bar. The list is under **Microservices**. The same list is also available in the Explorer.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `nestjsServices.nodePath` | `node` | Node.js executable used to start the local Nest CLI |
| `nestjsServices.watch` | `true` | Pass `--watch` to `nest start` |

## Source

[MaiNhanKiet/nest-microservices-manager-extension](https://github.com/MaiNhanKiet/nest-microservices-manager-extension)
