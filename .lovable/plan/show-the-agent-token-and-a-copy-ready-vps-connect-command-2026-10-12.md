# Show the agent token and a copy-ready VPS connect command

## What you'll see (Admin → Settings → 5-minute test VPS agent)
- Tap **Agent token তৈরি করুন**. The new token appears in a box right below. There is an eye button to show or hide it and a **Copy** button.
- Below that, a box shows the full **VPS connect command**, with the token, Agent host and port already filled in. Tap **কমান্ড কপি করুন** to copy it, paste it into your VPS terminal (as root), and the agent installs and connects.
- If Agent host is empty, the command box says "আগে Agent host দিন ও সেভ করুন" instead of a broken command.
- The full token is shown only right after you create it (for safety). After a page refresh you'll see only the masked token. Tap **নতুন token** to see a full command again. A new token replaces the old one, so run the new command on the VPS.
- After running it, **Agent connection test** should say "Test agent online".

## Example command shape
```text
curl -fsSL https://bright-ease.lovable.app/install-agent.sh | sudo HEXA_APP_URL=https://bright-ease.lovable.app bash -s -- <TOKEN> <AGENT_HOST> "" <PORT>
```

## Technical details
- `admin.settings.tsx` agent block: keep the token returned by `adminNewDeployToken` in component state (no longer only on the clipboard). Render a masked/reveal input, copy buttons, and a `<pre>` with the built command. The command uses the published site URL (`window.location.origin` when it isn't the preview host, otherwise `https://bright-ease.lovable.app`), `form.agent_host` and `form.agent_port`.
- No server or database change. `adminNewDeployToken` already returns the plaintext token once, and `adminGetDeployToken` keeps returning only the masked value.
