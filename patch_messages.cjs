const fs = require('fs');

let content = fs.readFileSync('src/tools/composite/messages.ts', 'utf8');

// replace the imports to include archiveEmails
content = content.replace(
  "import { listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'",
  "import { archiveEmails, listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'"
);

const handleArchiveOldStr = `async function handleArchive(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  // Check cache first
  let archiveFolder = archiveFolderCache.get(account.id)

  if (!archiveFolder) {
    // Detect archive folder based on provider
    archiveFolder = '[Gmail]/All Mail'
    if (account.imap.host.includes('office365') || account.imap.host.includes('outlook')) {
      archiveFolder = 'Archive'
    } else if (account.imap.host.includes('yahoo')) {
      archiveFolder = 'Archive'
    }

    // Try to find actual archive folder
    try {
      const folders = await listFolders(account)
      const found = folders.find(
        (f) =>
          f.path.toLowerCase().includes('archive') ||
          f.path.toLowerCase().includes('all mail') ||
          f.flags.some((flag) => flag.toLowerCase().includes('archive') || flag.toLowerCase().includes('all'))
      )
      if (found) {
        archiveFolder = found.path
      }
    } catch {
      // Use default if folder listing fails
    }

    // Cache the result
    archiveFolderCache.set(account.id, archiveFolder)
  }

  const result = await moveEmails(account, uids, folder, archiveFolder)

  return {
    action: 'archive',
    account: account.email,
    from_folder: folder,
    archive_folder: archiveFolder,
    ...result
  }
}`;

const handleArchiveNewStr = `async function handleArchive(accounts: AccountConfig[], input: MessagesInput): Promise<any> {
  const uids = input.uids || (input.uid ? [input.uid] : [])
  if (uids.length === 0) {
    throw new EmailMCPError('uid or uids required', 'VALIDATION_ERROR', 'Provide at least one email UID')
  }

  const account = resolveSingleAccount(accounts, input.account)
  const folder = input.folder || 'INBOX'

  // Check cache first
  const cachedArchiveFolder = archiveFolderCache.get(account.id)

  const result = await archiveEmails(account, uids, folder, cachedArchiveFolder)

  // Cache the detected folder for future operations
  if (!cachedArchiveFolder) {
    archiveFolderCache.set(account.id, result.archiveFolder)
  }

  return {
    action: 'archive',
    account: account.email,
    from_folder: folder,
    archive_folder: result.archiveFolder,
    ...result
  }
}`;

content = content.replace(handleArchiveOldStr, handleArchiveNewStr);

fs.writeFileSync('src/tools/composite/messages.ts', content);
