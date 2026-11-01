Lintel for hosting with a control panel
=======================================

The full guide, with pictures of each screen, is "Install on cPanel hosting" in Lintel's
documentation. In short:

1. In cPanel, open "Setup Node.js App" and click Create Application.
     Node.js version:            22 or newer
     Application mode:           Production
     Application root:           lintel (this folder)
     Application URL:            your domain
     Application startup file:   app.js
2. Upload this zip with File Manager and extract it into your home folder, so this file
   ends up in ~/lintel/README.txt.
3. Back in Setup Node.js App, add the environment variable PUBLIC_URL with your site's
   address (https://...), click Run NPM Install, then Restart.
4. Open your-domain/admin and follow the setup wizard. It asks for a setup code: open
   lintel/.lintel/setup-code.txt in File Manager (turn on "Show hidden files").
5. Add the cron job: in Setup Node.js App click "Run JS script", choose cron-line, and paste
   the line it prints into cPanel's Cron Jobs screen.

Not sure your hosting can run Lintel? Run the "check" script, or upload lintel-check.js on
its own first and open it as a Node.js app. On hosting without Node.js, upload
lintel-check.php instead and open it in your browser.

Restarting: the Restart button in Setup Node.js App, or change the date of tmp/restart.txt.
