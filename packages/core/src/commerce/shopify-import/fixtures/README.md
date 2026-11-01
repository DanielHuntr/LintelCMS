# Test files

Small exports in the shape Shopify's admin writes them, made by hand for the importer's
tests (no real shop's data):

- `products.csv`: a shirt with two variants and three photos (one hot-linked from another
  site), a tote without options whose photo redirects off Shopify's servers, a gift card,
  and socks whose photo is too large. Descriptions span lines; the file starts with a BOM
  and uses CRLF, as Excel-friendly exports do.
- `customers.csv`: two customers and one row without an email.
- `orders.csv`: two orders, one with two items over two rows, one refunded and cancelled.
