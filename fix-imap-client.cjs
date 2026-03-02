const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.ts', 'utf8');

const listFoldersOldStr = `export async function listFolders(account: AccountConfig): Promise<FolderInfo[]> {
  return withConnection(account, async (client) => {
    const mailboxes = await client.list()
    return mailboxes.map((mb: any) => ({
      name: mb.name,
      path: mb.path,
      flags: Array.from(mb.flags || []),
      delimiter: mb.delimiter || '/'
    }))
  })
}`;

const listFoldersNewStr = `export async function listFolders(account: AccountConfig): Promise<FolderInfo[]> {
  return withConnection(account, async (client) => {
    const mailboxes = await client.list()
    const folders: FolderInfo[] = []
    for (const mb of mailboxes) {
      folders.push({
        name: mb.name,
        path: mb.path,
        flags: Array.from(mb.flags || []),
        delimiter: mb.delimiter || '/'
      })
    }
    return folders
  })
}`;

const archiveEmailsOldStr = `      try {
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
      } catch {`;

const archiveEmailsNewStr = `      try {
        const mailboxes = await client.list()
        for (const mb of mailboxes) {
          const path = mb.path
          const flags = Array.from(mb.flags || []) as string[]

          if (
            path.toLowerCase().includes('archive') ||
            path.toLowerCase().includes('all mail') ||
            flags.some((flag: string) => flag.toLowerCase().includes('archive') || flag.toLowerCase().includes('all'))
          ) {
            archiveFolder = path
            break
          }
        }
      } catch {`;

content = content.replace(listFoldersOldStr, listFoldersNewStr);
content = content.replace(archiveEmailsOldStr, archiveEmailsNewStr);

fs.writeFileSync('src/tools/helpers/imap-client.ts', content);
