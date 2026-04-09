# Authentication & GitHub

esk uses GitHub as the backend for storing and sharing agents and skills. Authentication is handled via OAuth Device Flow — no password or token is ever entered manually.

---

## GitHub login

Connect to GitHub with a browser-based OAuth flow:

```bash
esk github:login
```

This will:
1. Display a one-time code in your terminal
2. Open your browser to `https://github.com/login/device`
3. Wait for you to enter the code and authorize
4. Save the token to `~/.esk/config.json`

**Example output:**
```
  GitHub Authentication

  Open your browser at : https://github.com/login/device
  Enter the code       : ABCD-1234

  ✓ Connected as edefiez
  ℹ Token saved to ~/.esk/config.json
  ℹ Now configure your registry: esk github:registry set <user/repo>
```

### JSON mode (for agents)

```bash
esk github:login --json
```

Returns:
```json
{ "success": true, "username": "edefiez" }
```

---

## GitHub logout

```bash
esk github:logout
```

Clears the token and username from the local config.

---

## Check connection status

```bash
esk github:status
```

Verifies the token is valid and checks access to the configured registry.

**Example output:**
```
  ✓ Connected: edefiez
  ✓ Registry: edefiez/esk-registry
```

```bash
esk github:status --json
```

Returns:
```json
{
  "connected": true,
  "username": "edefiez",
  "registry": "edefiez/esk-registry",
  "registryAccess": true
}
```

---

## Set the registry

The registry is a GitHub repo that stores your `registry.json`, agent prompts, and skill files.

```bash
esk github:registry set edefiez/esk-registry
```

esk verifies that the repo is accessible before saving.

**Example output:**
```
  ✓ Registry configured: edefiez/esk-registry
```

### View current registry

```bash
esk github:registry get
```

---

## Configuration file

All GitHub settings are stored in `~/.esk/config.json`:

```json
{
  "github": {
    "token": "gho_xxxxxxxxxxxx",
    "username": "edefiez",
    "registry": "edefiez/esk-registry"
  }
}
```

---

## Initialize a registry

**registry:init**: Create a new registry repo on GitHub with the complete esk structure.
```bash
esk registry:init
esk registry:init --name my-skills --private
```
Creates: repo on GitHub, registry.json, agents/ and skills/ directories, adds `esk-registry` topic, and sets it as your active registry. Perfect for getting started from scratch.

---

## Required GitHub permissions

The OAuth token requires:
- `repo` — read/write access to registry repos (for publishing agents and skills)
- `read:user` — read your GitHub profile (for displaying your username)

---

## GitHub OAuth App setup (for self-hosting)

If you're running your own fork of esk, you need to create a GitHub OAuth App:

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set the callback URL to `http://localhost` (not used in Device Flow, but required)
4. Enable **Device Flow** in the app settings
5. Copy the **Client ID**
6. Set it via environment variable:

```bash
export ESK_GITHUB_CLIENT_ID="Ov23liYourRealClientId"
```

Or add it to your shell profile (`~/.zshrc`, `~/.bashrc`).
