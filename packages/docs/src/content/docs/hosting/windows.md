---
title: Run on Windows Server
description: Lintel on Windows Server, started with Windows, behind IIS or Caddy with HTTPS.
since: "0.1"
sidebar:
  label: Windows Server
---

Lintel runs on Windows Server 2019, 2022 and 2025 (and Windows 10 or 11). It uses one
port, so IIS or Caddy in front needs a single rule. Run the commands below in
**PowerShell as Administrator**.

## 1. Install Node.js

Download the **Node.js 22 LTS** Windows installer (`.msi`, x64) from nodejs.org and run it
with the default choices. Check it in a new PowerShell window:

```powershell
node --version   # v22 or newer
```

## 2. Put Lintel on the server

The hosting package is the simplest way: it needs only Node.js and npm.

1. Copy `lintel-hosting-<version>.zip` to the server (developers make it with
   `pnpm build:hosting`).
2. Extract it to `C:\`, which gives `C:\lintel`.
3. Install its packages:

```powershell
cd C:\lintel
npm install --omit=dev
```

Then create `C:\lintel\.env` with Notepad (save as "All files", not `.env.txt`):

```bash
PUBLIC_URL=https://cms.example.com
HOST=127.0.0.1
PORT=4000
```

Try it: `node app.js`, then open `http://localhost:4000/admin` on the server. Press
<kbd>Ctrl</kbd>+<kbd>C</kbd> to stop it.

## 3. Start Lintel with Windows

Windows' own **Task Scheduler** can start Lintel at boot and restart it if it stops, with
nothing else to install:

```powershell
$action  = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "app.js" -WorkingDirectory "C:\lintel"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName "Lintel" -Action $action -Trigger $trigger -Settings $settings -User "NT AUTHORITY\NETWORK SERVICE" -RunLevel Limited
icacls C:\lintel /grant "NETWORK SERVICE:(OI)(CI)M"
Start-ScheduledTask -TaskName "Lintel"
```

`NETWORK SERVICE` is a built-in account with few rights; the `icacls` line lets it write
to `C:\lintel` (its database and uploads are in `C:\lintel\.lintel`). Check it is running
with `Get-ScheduledTask Lintel` and `curl.exe http://127.0.0.1:4000/health`.

To stop or restart it: `Stop-ScheduledTask Lintel`, then `Start-ScheduledTask Lintel`.
Stop it before copying files over an update.

If you'd rather see it under **Services**, use [WinSW](https://github.com/winsw/winsw), a
single `.exe`: rename it to `C:\lintel\lintel-service.exe`, put this beside it as
`lintel-service.xml`, and run `.\lintel-service.exe install` then `.\lintel-service.exe start`:

```xml
<service>
  <id>lintel</id>
  <name>Lintel</name>
  <executable>C:\Program Files\nodejs\node.exe</executable>
  <arguments>app.js</arguments>
  <workingdirectory>C:\lintel</workingdirectory>
  <onfailure action="restart" delay="10 sec" />
  <stoptimeout>15 sec</stoptimeout>
  <log mode="roll-by-size" />
</service>
```

## 4. Put IIS or Caddy in front

Choose one. Both get Lintel onto ports 80 and 443 with HTTPS; Lintel itself only listens
on `127.0.0.1:4000`.

### Caddy (simplest)

Download `caddy.exe` for Windows from caddyserver.com to `C:\caddy`, and create
`C:\caddy\Caddyfile`:

```text
cms.example.com {
	reverse_proxy 127.0.0.1:4000
}
```

Caddy gets and renews the HTTPS certificate itself. Run it as a Windows service:

```powershell
sc.exe create caddy start= auto binPath= "C:\caddy\caddy.exe run --config C:\caddy\Caddyfile"
sc.exe start caddy
```

### IIS

1. Install IIS with **Server Manager** (Web Server role), then install **URL Rewrite**
   and **Application Request Routing (ARR)** from Microsoft's IIS downloads.
2. In **IIS Manager**, click the server, open **Application Request Routing Cache**, then
   **Server Proxy Settings**, tick **Enable proxy** and apply.
3. Keep the visitor's host name, which Lintel needs for its links:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/proxy -preserveHostHeader:true /commit:apphost
```

4. Create a site for your domain (any empty folder, such as `C:\inetpub\lintel`) and put
   this `web.config` in that folder:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Lintel" stopProcessing="true">
          <match url="(.*)" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
          </serverVariables>
          <action type="Rewrite" url="http://127.0.0.1:4000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <!-- 32 MB, a little over Lintel's own 25 MB upload limit. -->
        <requestLimits maxAllowedContentLength="33554432" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

5. Allow the rule to set that header: in IIS Manager, open the site's **URL Rewrite**,
   click **View Server Variables** and add `HTTP_X_FORWARDED_PROTO`.
6. HTTPS: get a free certificate with [win-acme](https://www.win-acme.com/) (`wacs.exe`,
   choose your IIS site). It adds the HTTPS binding and renews the certificate.

## 5. Open the firewall

```powershell
New-NetFirewallRule -DisplayName "Web (HTTP and HTTPS)" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
```

Port 4000 stays closed: only IIS or Caddy on the same machine talks to Lintel.

## 6. Finish setting up

Open `https://cms.example.com/admin`. The setup code it asks for is in
`C:\lintel\.lintel\setup-code.txt`.

## Updating

Stop Lintel, extract the new zip over `C:\lintel` (your content in `C:\lintel\.lintel`
stays), run `npm install --omit=dev`, and start it again. Back up `C:\lintel\.lintel`
first.

## If something goes wrong

- **IIS shows 502.3**: Lintel isn't running, or isn't on port 4000. Run `node app.js` in
  `C:\lintel` by hand to see why.
- **Links and sign-in point at `127.0.0.1`**: the host header isn't kept (step 4.3).
- **Uploads over 28 MB fail in IIS**: the `requestLimits` line in `web.config` is missing.
