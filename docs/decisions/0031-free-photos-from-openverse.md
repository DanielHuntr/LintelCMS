# 31. Free photos come from Openverse, through the server, with a credit on the file

Date: 2026-11-03

## Decision

The optional **Free photos** plugin searches Openverse (openverse.org, run by WordPress.org)
for openly licensed photos and adds one to the media library as an ordinary file. It is off
until someone switches it on, because it sends searches to another service.

- **Openverse, not a commercial stock library.** Its public API needs no key or account, so
  a site works the moment the plugin is on, and nobody has to sign up anywhere or agree to
  another company's terms on a client's behalf.
- **Only business-safe licences.** CC0, the Public Domain Mark, CC BY and CC BY-SA. Non-commercial
  (NC) and no-derivatives (ND) licences are left out: a business site is commercial, and a
  crop is a change. The licence is asked for in the search and checked again on every result
  and before every download.
- **Everything goes through the server.** The admin asks Lintel, and Lintel asks Openverse.
  The admin's Content-Security-Policy stays closed to other addresses, and editors'
  addresses aren't shared. Thumbnails come through Lintel too.
- **Downloads get the webhook address checks.** The full-size file lives wherever Openverse
  says (Flickr, Wikimedia Commons, a museum), so local and private addresses are refused,
  checked on the address actually connected to, after every redirect.
- **The credit is kept on the file.** Media items gain a `credit` column (migration
  `0026_asset_credit`): plain text, empty for most files, editable in the file's details.
  A free photo's credit is written as the licences ask (title, creator, licence with its
  link, and source), ready to print under the photo or on a credits page.

## Why a column rather than the alt text or the filename

Alt text describes the picture for people who can't see it; putting a licence there would
read out a web address to screen reader users. A filename is cut short and cleaned. A credit
is its own kind of information, which other files (a photographer's own work, say) need too.

## Consequences

- Openverse limits anonymous use per server (20 searches a minute, 200 a day and 1,000
  thumbnails a day when this was written). Searches are kept for 10 minutes and thumbnails
  for an hour, and "too many" is explained in plain words. A busy agency server could reach
  the daily limit; registering for a key is the way on if that happens.
- Sites show the credit under the picture where the licence asks for one (see below).
- Some photos Openverse lists have gone from the site they came from. Their thumbnail
  fails, and the admin leaves them out.

## Update, 3 November 2026: credits on the website

Visitors and photographers expect to see who took a photo, and CC BY and CC BY-SA require it.
So the website now shows the credit under a picture:

- **Where:** the builder's Picture element, image fields drawn by the site's components (the
  image section), and Liquid's `{% image %}`. Each is drawn as a `<figure>` with
  `<figcaption class="lintel-credit">`, small and quiet, in the theme's own colours, such as
  "Photo: Ian Sane, CC BY 2.0". The creator links to where the photo was found, and the
  licence to its terms.
- **Which pictures:** a CC0 or Public Domain Mark photo shows nothing, because those
  licences ask for nothing. A credit typed by hand counts as wanted and is shown as typed.
- **What is stored:** free photos keep the credit's parts (licence code and name, its link,
  creator, source) beside the text, in `assets.credit_details` (migration
  `0027_asset_credit_details`). Editing the credit by hand clears the parts, so what shows is
  what was typed. The delivery API gives each image its `credit`, so headless sites can show
  it too.
- **Switching it off:** the Picture element has "Show the photo credit", on by default and
  only offered when there is a credit to show. Turned off, it says the licence asks for a
  credit. Liquid's `{% image %}` takes `credit: false`. Both are for pages that credit photos
  somewhere else; hiding a required credit without that breaks the licence.
