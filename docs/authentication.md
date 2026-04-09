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

## Required GitHub permissions

The OAuth token requires:
- `repo` — read/write access to registry repos (for publishing agents and skills)
- `read:user` — read your GitHub profile (for displaying your username)
