/**
 * Builds a multipart/form-data body by hand, the way a browser sends a file input, so
 * upload tests can use `server.inject` without a form-data library.
 */
export function multipartFile(
  filename: string,
  contents: Buffer,
  contentType = "application/octet-stream",
  fieldName = "file",
) {
  const boundary = "----lintel-test-boundary";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    payload: Buffer.concat([head, contents, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}
