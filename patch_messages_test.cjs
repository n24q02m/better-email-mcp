const fs = require('fs');

let content = fs.readFileSync('src/tools/composite/messages.test.ts', 'utf8');

// replace mock imports
content = content.replace(
  "moveEmails: vi.fn(),",
  "archiveEmails: vi.fn(),\n  moveEmails: vi.fn(),"
);
content = content.replace(
  "import { listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'",
  "import { archiveEmails, listFolders, modifyFlags, moveEmails, readEmail, searchEmails, trashEmails } from '../helpers/imap-client.js'"
);
content = content.replace(
  "const mockMoveEmails = vi.mocked(moveEmails)",
  "const mockArchiveEmails = vi.mocked(archiveEmails)\nconst mockMoveEmails = vi.mocked(moveEmails)"
);

const archiveTestOldStr = `describe('messages - archive', () => {
  it('moves to Gmail archive folder', async () => {
    mockListFolders.mockResolvedValue([
      { name: 'All Mail', path: '[Gmail]/All Mail', flags: ['\\\\All'], delimiter: '/' }
    ])
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    expect(result.action).toBe('archive')
    expect(result.archive_folder).toBe('[Gmail]/All Mail')
  })

  it('falls back to default archive folder if listing fails', async () => {
    mockListFolders.mockRejectedValue(new Error('fail'))
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    expect(result.archive_folder).toBe('[Gmail]/All Mail')
  })

  it('uses Archive for Outlook accounts', async () => {
    mockListFolders.mockResolvedValue([{ name: 'Archive', path: 'Archive', flags: ['\\\\Archive'], delimiter: '/' }])
    mockMoveEmails.mockResolvedValue({ success: true, moved: 1 })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user2@outlook.com' })

    expect(result.archive_folder).toBe('Archive')
  })
})`;

const archiveTestNewStr = `describe('messages - archive', () => {
  it('calls archiveEmails and returns detected folder', async () => {
    mockArchiveEmails.mockResolvedValue({ success: true, moved: 1, archiveFolder: '[Gmail]/All Mail' })

    const result = await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    expect(result.action).toBe('archive')
    expect(result.archive_folder).toBe('[Gmail]/All Mail')
    expect(mockArchiveEmails).toHaveBeenCalledWith(accounts[0], [1], 'INBOX', undefined)
  })

  it('uses cached folder on subsequent calls', async () => {
    mockArchiveEmails.mockResolvedValue({ success: true, moved: 1, archiveFolder: '[Gmail]/All Mail' })

    // First call caches the folder
    await messages(accounts, { action: 'archive', uid: 1, account: 'user1@gmail.com' })

    // Second call should pass the cached folder
    await messages(accounts, { action: 'archive', uid: 2, account: 'user1@gmail.com' })

    expect(mockArchiveEmails).toHaveBeenLastCalledWith(accounts[0], [2], 'INBOX', '[Gmail]/All Mail')
  })
})`;

content = content.replace(archiveTestOldStr, archiveTestNewStr);

fs.writeFileSync('src/tools/composite/messages.test.ts', content);
