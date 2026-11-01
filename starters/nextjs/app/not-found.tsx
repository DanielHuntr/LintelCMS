import Link from "next/link";

export default function NotFound() {
  return (
    <section className="notice">
      <h1>Page not found</h1>
      <p>
        There&rsquo;s nothing published at this address. It may not be published yet, or it may have
        moved.
      </p>
      <p>
        <Link href="/">Go to the home page</Link>
      </p>
    </section>
  );
}
