const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.ts', 'utf8');

const moveEmailsStr = `
/**
 * Move emails to another folder
 */
export async function moveEmails(
  account: AccountConfig,
  uids: number[],
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean; moved: number }> {
  return withConnection(account, async (client) => {
    const lock = await client.getMailboxLock(fromFolder)
    try {
      const uidStr = uids.join(',')
      await client.messageMove({ uid: uidStr }, toFolder)
      return { success: true, moved: uids.length }
    } finally {
      lock.release()
    }
  })
}
`;

const archiveEmailsStr = `
/**
 * Archive emails (find archive folder and move)
 */
export async function archiveEmails(
  account: AccountConfig,
  uids: number[],
  fromFolder: string,
  cachedArchiveFolder?: string
): Promise<{ success: boolean; moved: number; archiveFolder: string }> {
  return withConnection(account, async (client) => {
    let archiveFolder = cachedArchiveFolder;

    if (!archiveFolder) {
      archiveFolder = '[Gmail]/All Mail'
      if (account.imap.host.includes('office365') || account.imap.host.includes('outlook')) {
        archiveFolder = 'Archive'
      } else if (account.imap.host.includes('yahoo')) {
        archiveFolder = 'Archive'
      }

      try {
        const mailboxes = await client.list()
        const folders = mailboxes.map((mb: any) => ({
          name: mb.name,
          path: mb.path,
          flags: Array.from(mb.flags || []),
          delimiter: mb.delimiter || '/'
        }))
        const found = folders.find(
          (f) =>
            f.path.toLowerCase().includes('archive') ||
            f.path.toLowerCase().includes('all mail') ||
            f.flags.some((flag: string) => flag.toLowerCase().includes('archive') || flag.toLowerCase().includes('all'))
        )
        if (found) {
          archiveFolder = found.path
        }
      } catch {
        // Use default if folder listing fails
      }
    }

    const lock = await client.getMailboxLock(fromFolder)
    try {
      const uidStr = uids.join(',')
      await client.messageMove({ uid: uidStr }, archiveFolder)
      return { success: true, moved: uids.length, archiveFolder }
    } finally {
      lock.release()
    }
  })
}
`;

content = content.replace(moveEmailsStr, moveEmailsStr + archiveEmailsStr);
fs.writeFileSync('src/tools/helpers/imap-client.ts', content);
