# Publishing remotes

The places a website is published to, whatever the protocol. Each opens a `RemoteFolder`
(`remote-folder.ts`), which can read, write and delete files, so the rest of publishing doesn't
know which one it has.

| File               | Where it publishes                                       |
| ------------------ | -------------------------------------------------------- |
| `ftp-remote.ts`    | FTP and FTPS, which every shared host offers             |
| `sftp-remote.ts`   | SFTP, over SSH                                           |
| `s3-remote.ts`     | An S3 bucket, or anything that speaks the same language  |
| `folder-remote.ts` | A folder on the server Lintel runs on                    |
| `remote-folder.ts` | The interface, and the check on how far a path may reach |

Paths are relative to the folder the destination points at, with `/` between parts. One step up
is allowed, for the companion's private folder beside the website, and no further:
`remotePath` and the folder remote both refuse the rest. Writing goes to a temporary name first
and is then renamed, where the protocol can, so a visitor never gets half a page.

A remote doesn't decide whether a destination is allowed. That is `../destination-safety.ts`,
which runs before one is opened. `../target-remotes.ts` picks the remote for a destination.
