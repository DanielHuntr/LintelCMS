/**
 * Release notes as the API rendered them from Markdown. The API shows any HTML typed into
 * the notes as text and refuses unsafe links, so the HTML is safe to put on the page.
 */
export function ReleaseNotes({ html }: { html: string }) {
  return (
    <div
      className="text-body text-label [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-fill [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.92em] [&_h1]:mt-4 [&_h1]:text-headline [&_h2]:mt-4 [&_h2]:text-headline [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
