# Site

`/settings/site` (`SiteSettingsPage.tsx`): the address of the website Lintel's content
appears on, such as `https://brightsidebakery.com`. It is saved with `PUT /site-address`
(`site.api.ts`) and comes back in the session, so after saving the page reloads the router
and every **View page** link (see `src/content/viewPage.ts`) points at the new address.

Leaving it empty is fine: View page then opens Lintel's simple preview of the published
page, with a note on connecting a site. Only people with `settings:update` can change it.
