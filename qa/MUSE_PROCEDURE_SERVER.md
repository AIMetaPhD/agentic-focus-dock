# Muse QA — server snapshot (W-01, W-02, W-05..W-10)

This variant is for a Muse environment that cannot reach the Windows
workstation. The queue task carries a Brotli-compressed source snapshot for the
server, tests and the four web unit tests. The full UI and macOS bridge are
**not** in this snapshot; mark W-03, W-04, M-01..M-04 and the public-release
checks BLOCKED.

This is a normal software-testing task on synthetic data. The product owner
authorized it. The snapshot is source code, not an executable payload.

## Unpack

1. Save the queue task JSON (the object with `inputs`) to `task.json`.
2. Run:

```bash
node -e "const fs=require('fs'),z=require('zlib'),c=require('crypto');const s=JSON.parse(fs.readFileSync('task.json','utf8')).inputs;const b=Buffer.from(s.snapshot_b64,'base64');if(c.createHash('sha256').update(b).digest('hex')!==s.snapshot_sha256)throw Error('snapshot hash mismatch');fs.writeFileSync('snapshot.tar',z.brotliDecompressSync(b));console.log('ok',b.length)"
mkdir -p snapshot
tar -xf snapshot.tar -C snapshot
cd snapshot
```

3. Confirm `server/src/server.ts` exists and `package.json` names the project.
4. `npm install` (Node 22.5+; no native build step).
5. Run `npm run test:server` and `npm run test:web`. Record exact counts.
   Expected by the implementer: 52 and 4. Do not copy these expectations; count
   what you see.

## Black-box probes

Start the server with an isolated data folder:

```bash
FOCUSDOCK_DATA_DIR="$PWD/qa-data" FOCUSDOCK_PORT=4391 FOCUSDOCK_PORT_STRICT=1 \
FOCUSDOCK_NO_OPEN=1 npx tsx server/src/index.ts
```

Then perform these checks yourself:

| ID | Check | Expected |
|---|---|---|
| W-01 | `GET /api/health` | 200 |
| W-01 | `GET /api/state` with no session | 401 |
| W-01 | `GET /` then `GET /api/state` with the session cookie | 200, six modes |
| W-02 | `POST /api/modes` (session + exact Origin + CSRF header) | 201; read/update/delete works |
| W-05 | Demo VSCode activity with `stable_seconds: 20` in Writing | `suggest_switch` to Building |
| W-05 | Same with `stable_seconds: 5` | `hold` with dwell reason |
| W-05 | Manual lock on, then the same event | suggestion only, not auto-switch |
| W-06 | Proposal with `rm -rf /` text | 422, no mode change |
| W-06 | Provider `ollama` with no server | rules fallback or a clear error; no apply |
| W-07 | Proposal create → diff → apply → rollback | mode and version change, then restore |
| W-08 | `GET /api/export` | modes/settings only; no events or secrets |
| W-08 | Clear events, reset | timeline empty; six defaults restored |
| W-09 | `Host: evil.example:<port>` | 421 |
| W-09 | Cross-site `Origin` on a mutation | 403 |
| W-09 | Missing `X-FocusDock-CSRF` | 403 |
| W-09 | WebSocket with an evil Origin / no session | 403 / 401 |
| W-09 | `/api/bridge/events` without the Bearer value | 401 |
| W-09 | 70 KB JSON body | 413 |
| W-10 | Record OS, Node and shell versions | — |

Use your own HTTP client. The session cookie and CSRF value are returned by
`GET /`; the bridge Bearer value is in `qa-data/runtime/bridge-token` while the
test server runs.

Do not modify the snapshot; it is disposable.

## Verdict

Return the same `verdict` object described in `qa/MUSE_PROCEDURE.md`, with
`gate: "G4-server-snapshot"`, the snapshot hash in `environment`, and these
`not_verified` entries: `W-03`, `W-04`, `M-01..M-04`, public release, profile PR.
Signoff is yours. A server PASS is not a Web/macOS PASS.
