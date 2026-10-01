# NavAR AR Development: Node Editor Step-by-Step Guide

Goal: make the **Edit Map** button on the AR Development page open your Figma Make node editor, **frontend only** (no backend yet), using only the files you actually need.

Suggested location in your repo: `navar/MD files/frontend/ar-development-node-editor-step-by-step.md`

Checked against: your `navar-web-9-28.zip` frontend plus `Node_Editor_for_Mall_Floor_Plan.zip`. I copied your frontend, applied every edit below, and ran `npx vite build`. It compiled with no errors. I did not click through it in a browser, so Part 7 is your real test.

---

## How to read this guide

Every step is tagged with **where** you do it:

| Tag | Meaning |
|---|---|
| **[FILE EXPLORER]** | Windows File Explorer (unzipping and copying folders) |
| **[VS CODE]** | Editing files in your editor |
| **[TERMINAL]** | A command you type in the VS Code terminal |
| **[BROWSER]** | Testing the running NavAR web app |

Each step says what to **do**, what you should **see**, and what to do **if not**.

**Line numbers drift.** The guide tells you what text to search for (Ctrl+F in VS Code), not just a line number.

---

## Part 0: What you are building

### 0.1 Which button is this?

In `ARDevTable.jsx` the only button that does nothing right now is **Edit Map** (its code is `onClick={() => {}}` and its tooltip says "not yet available"). This guide wires that button. If you meant a different button, stop here and tell me which one.

### 0.2 What will happen after this guide

1. Super Admin logs in, opens **AR Development**, clicks **Edit Map** on any row.
2. The browser goes to `/ar-development/editor/<project id>` and shows the **full-screen node editor** (no sidebar, its own top bar) with the mall name in the top bar.
3. The **← Back** button returns to the AR Development table.
4. Every mall shows the **same sample map** (SM Seaside City sample data: 3 floors, stores, stairs, elevators, and so on), because there is no backend yet.
5. Your edits (nodes, edges, scale) are saved in the **browser's localStorage** when you press Save Draft, so a refresh does not lose them.

### 0.3 What this guide does not do

- No backend, no Supabase tables, no API calls. Nothing is sent anywhere.
- The **table row's status** (Pending, Node Mapping, and so on) does not change when you press Save inside the editor. The editor has its own status stepper. Hooking them together needs the backend.
- The floor-plan area is the editor's placeholder ("Floor plan image renders here"). Uploading a real floor plan image is a later feature.

---

## Part 1: What is inside the Figma Make zip (and what to ignore)

Figma Make gave you a whole standalone app. You need **one folder** out of it.

| In `Node_Editor_for_Mall_Floor_Plan.zip` | Take it? | Why |
|---|---|---|
| **`exports/node-editor-jsx/`** | **YES, only this** | This is the editor already converted to plain JavaScript/JSX with no Tailwind or shadcn needed. It matches your "JavaScript, not TypeScript" decision. |
| `exports/node-editor-jsx.zip` | No | The same folder, zipped. |
| `src/app/*.tsx`, `src/app/components/*.tsx` | No | The TypeScript version of the same editor. |
| `src/app/components/ui/*` (about 45 files) | No | shadcn/ui components. The editor does not use them. |
| `src/imports/ar-development-v10_(1).jsx` | No | Figma's mock of the whole AR Development page. You already have your real page. |
| `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `index.html` | No | Project config for a separate app. Your `navar-frontend` already has its own. |
| `.figma/`, `AGENTS.md`, `CLAUDE.md`, `guidelines/`, `ATTRIBUTIONS.md`, `assets/` | No | Figma Make internals. |

**Why no new packages:** the editor only imports `react`, which your project already has. You do **not** run `npm install` for this.

### The files inside `node-editor-jsx/`

| File | What it does |
|---|---|
| `nodeEditor.jsx` | The main editor screen: top bar, tools, floors, side panels, save and lock logic |
| `components/NodeCanvas.jsx` | Draws the canvas, dragging nodes |
| `components/PlaceModal.jsx` | The popup when you place a node |
| `components/CalibrationModal.jsx` | The popup for setting scale (px per meter) |
| `components/DataTable.jsx` | The "View Data" table |
| `hooks/useHistory.js` | Undo and redo |
| `editorConstants.js` | Node types, floors, sample stores, colors |
| `editorData.js` | The sample nodes, edges, calibration |
| `nodeEditor.css` | Loads the two fonts (Plus Jakarta Sans, DM Mono) |
| `index.js` | Optional re-export. We import `nodeEditor.jsx` directly, so it is not used. |
| `README.md` | Figma's notes. Not needed in your repo. |

---

## Part 2: Copy the folder into your repo

### 2.1 Unzip the Figma Make zip

1. **[FILE EXPLORER]** Right-click `Node_Editor_for_Mall_Floor_Plan.zip`, then **Extract All...**, and extract anywhere temporary (Desktop is fine). This is **not** inside your repo.
2. Open the extracted folder, then **`exports`**, then **`node-editor-jsx`**.
3. You should see: `components`, `hooks`, `editorConstants.js`, `editorData.js`, `index.js`, `nodeEditor.css`, `nodeEditor.jsx`, `README.md`.
4. **If not:** the extractor sometimes adds one extra folder level (for example `Node_Editor_for_Mall_Floor_Plan\Node_Editor_for_Mall_Floor_Plan\exports`). Keep opening folders until you find `exports`.

### 2.2 Create the destination folder

1. **[VS CODE]** In the Explorer panel, expand `navar-frontend`, then `src`, then `components`.
2. Right-click `components`, then **New Folder**, and name it exactly **`nodeEditor`**.

Path: `navar\navar-frontend\src\components\nodeEditor`

### 2.3 Copy the files in

1. **[FILE EXPLORER]** Inside `node-editor-jsx`, press **Ctrl+A** to select everything.
2. **Ctrl+C**, then open your repo's `navar-frontend\src\components\nodeEditor` folder and press **Ctrl+V**.
3. Delete `README.md` from the new folder (optional, it is only Figma's notes).

### 2.4 Check the result

You should see exactly this:

```text
navar-frontend/src/components/nodeEditor/
  nodeEditor.jsx
  nodeEditor.css
  editorConstants.js
  editorData.js
  index.js
  components/
    CalibrationModal.jsx
    DataTable.jsx
    NodeCanvas.jsx
    PlaceModal.jsx
  hooks/
    useHistory.js
```

**If not:** the most common mistake is a double folder, like `nodeEditor/node-editor-jsx/nodeEditor.jsx`. Move the files up one level so `nodeEditor.jsx` sits directly inside `nodeEditor`.

The `components` folder inside `nodeEditor` looks odd next to `src/components`, but leave it. The files import each other with relative paths (`./components/NodeCanvas`), and renaming it would break them.

---

## Part 3: Edit `nodeEditor.jsx` (3 small changes)

The editor currently hardcodes the mall name and has no way to go back. You fix both.

**[VS CODE]** Open `src/components/nodeEditor/nodeEditor.jsx`.

### 3.1 Accept `mallName` and `onBack` props

1. Press **Ctrl+F** and search: `export default function NodeEditor()`
2. Replace that whole line with:

```jsx
export default function NodeEditor({ mallName = "SM Seaside City Cebu", onBack }) {
```

### 3.2 Show the mall name from the prop

1. Ctrl+F and search: `SM Seaside City Cebu</span>`
2. You will land on this line (in the top bar):

```jsx
<span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>SM Seaside City Cebu</span>
```

3. Replace it with:

```jsx
<span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{mallName}</span>
```

### 3.3 Add a Back button to the top bar

1. Ctrl+F and search for the hexagon symbol: `⬡`
2. You land on the line that draws the small blue NavAR logo square. It starts with `<div style={{ width: 26, height: 26, borderRadius: 7, background: C.blue`.
3. Click at the **very start** of that line (before `<div`), press **Enter** to make an empty line above it, and paste this on the empty line:

```jsx
{onBack && (<button onClick={onBack} title="Back to AR Development" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.white, color: "#334155", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
  ← Back
</button>)}
```

4. Save the file (Ctrl+S).

**If not:** if VS Code shows red squiggles right after pasting, you probably pasted inside another tag. The block must sit directly above the logo `<div>`, at the same nesting level as the `<span>` elements around it.

---

## Part 4: Create the page component

**[VS CODE]**

1. Right-click `src/pages`, then **New File**, and name it `NodeEditorPage.jsx`.
2. Paste:

```jsx
import { useLocation, useNavigate } from 'react-router-dom'
import NodeEditor from '../components/nodeEditor/nodeEditor.jsx'

export default function NodeEditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const mallName = location.state?.mallName

  return (
    <NodeEditor
      mallName={mallName}
      onBack={() => navigate('/ar-development')}
    />
  )
}
```

3. Save.

Why a page wrapper instead of using the editor directly: the editor knows nothing about routing. This small file is the bridge, so `nodeEditor.jsx` stays close to the Figma export and easy to replace later.

---

## Part 5: Add the route in `App.jsx`

The editor is designed as a **full-height workspace** (its own top bar, side panels, `100vh`). If it rendered inside your normal layout it would be squeezed under the NavAR top bar and next to the sidebar. So we render it **outside** the shell, the same way your `/auth/...` pages already skip the shell.

**[VS CODE]** Open `src/App.jsx`.

### 5.1 Add the import

1. Ctrl+F and search: `import ARDevelopment from './pages/ARDevelopment'`
2. On the line right below it, add:

```jsx
import NodeEditorPage from './pages/NodeEditorPage'
```

### 5.2 Add the full-screen route

1. Ctrl+F and search: `const activePage = getActiveNavItem(location.pathname).label`
2. Click at the start of that line, press Enter to make blank lines above it, and paste this **above** it:

```jsx
  // Full-screen node editor: rendered outside the sidebar/top bar shell
  if (location.pathname.startsWith('/ar-development/editor/')) {
    return (
      <Routes>
        <Route path="/ar-development/editor/:projectId" element={<NodeEditorPage />} />
      </Routes>
    )
  }

```

3. Save.

**Why this exact spot matters:**

- It comes **after** the checks that show the login page when there is no session or the user is not a Super Admin. So the editor is still behind login. Opening the URL while logged out sends you to the login page like every other page.
- It comes **after** all the `useState` and `useEffect` calls in `App`, so it does not break React's rules of hooks.

Do **not** move it above the `if (!session || !admin)` block. That would make the editor reachable without logging in, which goes against your CONTEXT.md security rules ("no client-only route guards / bypasses").

---

## Part 6: Wire the Edit Map button in `ARDevTable.jsx`

**[VS CODE]** Open `src/components/arDevelopment/ARDevTable.jsx`.

### 6.1 Import `useNavigate`

1. Ctrl+F and search: `import { useSearchParams } from 'react-router-dom'`
2. Replace it with:

```jsx
import { useNavigate, useSearchParams } from 'react-router-dom'
```

### 6.2 Create the `navigate` function

1. Ctrl+F and search: `const [searchParams] = useSearchParams()`
2. On the line right below it, add:

```jsx
  const navigate = useNavigate()
```

### 6.3 Make the button do something

1. Ctrl+F and search: `Edit Map (not yet available)`
2. You will land on this button:

```jsx
<button
  className="ar-dev-action-btn ar-dev-action-btn--edit-map"
  onClick={() => {}}
  title="Edit Map (not yet available)"
>
  Edit Map
</button>
```

3. Change only the `onClick` and `title` lines so it reads:

```jsx
<button
  className="ar-dev-action-btn ar-dev-action-btn--edit-map"
  onClick={() => navigate(`/ar-development/editor/${project.id}`, { state: { mallName: project.mallName } })}
  title="Open the node editor"
>
  Edit Map
</button>
```

4. Save.

What this does: it goes to the editor URL and passes the mall name along, so the editor's top bar shows the mall you clicked. The `state` is kept by the browser on refresh, so refreshing the editor page keeps the name.

---

## Part 7: Run it and test

### 7.1 Start the frontend

1. **[TERMINAL]** From the `navar-frontend` folder:

```powershell
npm run dev
```

2. You should see a local address like `http://localhost:5173`.
3. **If not:** if you see `Failed to resolve import "../components/nodeEditor/nodeEditor.jsx"`, the folder is in the wrong place or misnamed. Re-check Part 2.4.

### 7.2 Log in and open the editor

1. **[BROWSER]** Open the address, log in as your Super Admin.
2. Click **AR Development** in the sidebar.
3. Click **Edit Map** on any row (for example SM Seaside City Cebu).
4. You should see the full-screen editor. The top bar shows `NavAR · Node Editor · <that mall's name>`, and the Back button is at the far left.

The backend does not need to be running just to see the editor, but you still need to be logged in. Login and the admin check go through your backend and Supabase, as they already do for every other page.

### 7.3 Test checklist

Go through these once:

| # | Try this | Expected |
|---|---|---|
| 1 | Click the **Ground Floor / Level 2 / Level 3** tabs | Each floor shows its own sample nodes and edges |
| 2 | **Select & Move**: click a node, then drag it | The node moves; the right panel shows its properties |
| 3 | **Place Node** tool, click on the canvas | A popup appears; confirming adds a node |
| 4 | **Connect Nodes** tool, click two nodes | An edge appears (with a distance if that floor has a scale) |
| 5 | **Ctrl+Z** and **Ctrl+Y** | Undo and redo work |
| 6 | **Save Draft** (or Ctrl+S), then press **F5** to refresh | Your edits are still there |
| 7 | **View Data** | A table of nodes and edges opens |
| 8 | **Save** (the blue button), then **Validate & Save** | Either a warning about unlinked stairs/elevators, or the editor locks with a banner |
| 9 | If locked: **Revert to Draft** | Editing unlocks again |
| 10 | **← Back** | Returns to the AR Development table |

### 7.4 Reset the demo data

The editor keeps its state in the browser under three keys. To go back to the fresh sample map:

1. **[BROWSER]** Press **F12**, open the **Application** tab (in Firefox: **Storage**).
2. Expand **Local Storage**, then click your `localhost` address.
3. Delete these keys: `navarEditorDraft_v3`, `navarEditorStatus_v1`, `navarEditorSavedTs_v1`.
4. Refresh the page.

Do this **before your presentation** so you start from a clean state.

---

## Part 8: Things to know before you present

- **Same data for every mall.** All rows open the same sample map, and edits are shared across malls, because they are stored under the same browser keys. This matches what you asked for. Only the mall name in the top bar changes.
- **Locked after Save.** The editor's **Save** button locks editing and moves its stepper to "Node Mapping". Use **Revert to Draft** to edit again. If you want to demo editing, use **Save Draft**, not **Save**, or be ready to click Revert.
- **Unlinked floor transitions block Save.** Stairs, escalators, elevators, and ramps must link to a counterpart on another floor. The sample data is already linked, so Save works out of the box. New transition nodes you add must be linked in the right panel first.
- **Internet for fonts.** The editor loads its fonts from Google Fonts. Without internet it still works but uses fallback fonts.
- **Screen size.** The editor is built for desktop. Below about 1024 px wide it will not fit well. Present it on a laptop or projector, not a phone.
- **The floor plan image is a placeholder.** The canvas says "Floor plan image renders here". That is expected for now.
- **The table status does not change** when you save inside the editor (see 0.3).

---

## Part 9: Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Failed to resolve import ".../nodeEditor.jsx"` | Wrong folder depth or name | Part 2.4: `nodeEditor.jsx` must sit directly in `src/components/nodeEditor/` |
| `Failed to resolve import "./components/NodeCanvas"` | The inner `components` folder was renamed or not copied | Copy the whole `components` and `hooks` folders from the export |
| Clicking Edit Map does nothing | The `onClick` edit was not saved, or `navigate` is undefined | Redo 6.2 and 6.3, then save |
| `navigate is not defined` | Missed the `useNavigate` import or the `const navigate` line | Redo 6.1 and 6.2 |
| Blank white page at `/ar-development/editor/1` | Syntax error in `nodeEditor.jsx` from the Part 3 edits | Check the terminal and browser console (F12); the Back button block (3.3) is the usual culprit |
| Editor appears **inside** the sidebar layout | The route block in 5.2 is in the wrong place | It must be above `const activePage = ...`, not inside the `<Routes>` in the shell |
| Redirected to the login page | You are logged out, or the session expired | Log in again. This is the intended protection |
| Top bar shows "SM Seaside City Cebu" for every mall | State was not passed, for example opening the URL by hand | Click Edit Map from the table instead of typing the URL |
| Editor is stuck read-only | You pressed Save earlier | Click **Revert to Draft**, or clear the localStorage keys (7.4) |
| Old map keeps showing after you replaced the files | Browser still holds the saved draft | Clear the localStorage keys (7.4) |
| Fonts look different | Offline, or Google Fonts blocked | Connect to the internet; the editor works either way |

---

## Part 10: Later, when the backend exists

You do not need any of this now. It is here so the next step is not a surprise.

- The editor reads and writes only through two functions in `nodeEditor.jsx`: `loadNodeDraft` and `persistNodeData`. Replacing their localStorage code with calls to your Fastify backend is the main change.
- Figma's README suggests these endpoints, which you can adapt:

```text
GET  /api/malls/:mallId/node-map
PUT  /api/malls/:mallId/node-map/draft
POST /api/malls/:mallId/node-map/submit
```

- The saved shape is `{ nodes, edges, calibration }`, each keyed by floor name. That maps onto your ERD's node, edge, and `FLOOR_CALIBRATION` tables (remember AR development versioning is tied to edges, not nodes).
- Any real endpoint must follow your CONTEXT.md security rules: require the auth guard and the Super Admin role, and validate the payload on the server. Do not trust the editor's data just because it comes from your own frontend.
- The route already carries `:projectId`. Use it (or the mall id) to load the right map per mall instead of the shared sample data.

---

## Part 11: Commit checklist

Files you should see as changed or new in Git:

| File | Change |
|---|---|
| `src/components/nodeEditor/**` | New folder (10 files) |
| `src/pages/NodeEditorPage.jsx` | New |
| `src/App.jsx` | Edited (import and route block) |
| `src/components/arDevelopment/ARDevTable.jsx` | Edited (import, hook, button) |

If Git shows anything else (especially `.env` files, `dist/`, or the Figma project folders), do not add it.
