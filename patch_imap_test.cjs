const fs = require('fs');

let content = fs.readFileSync('src/tools/helpers/imap-client.test.ts', 'utf8');

content = content.replace(
  "moveEmails,",
  "archiveEmails,\n  moveEmails,"
);

const archiveTestStr = `// ============================================================================
// archiveEmails
// ============================================================================

describe('archiveEmails', () => {
  it('uses cached folder if provided', async () => {
    const result = await archiveEmails(account, [1, 2], 'INBOX', 'MyArchiveFolder')

    expect(mockClient.messageMove).toHaveBeenCalledWith({ uid: '1,2' }, 'MyArchiveFolder')
    expect(result.success).toBe(true)
    expect(result.moved).toBe(2)
    expect(result.archiveFolder).toBe('MyArchiveFolder')
    // Should not list folders
    expect(mockClient.list).not.toHaveBeenCalled()
  })

  it('detects archive folder and moves emails', async () => {
    // Reset list mock to return folders
    mockClient.list.mockResolvedValue([
      { name: 'INBOX', path: 'INBOX', flags: [], delimiter: '/' },
      { name: 'SomeArchive', path: 'SomeArchive', flags: ['\\\\Archive'], delimiter: '/' }
    ])

    const result = await archiveEmails(account, [1, 2], 'INBOX')

    expect(mockClient.messageMove).toHaveBeenCalledWith({ uid: '1,2' }, 'SomeArchive')
    expect(result.success).toBe(true)
    expect(result.moved).toBe(2)
    expect(result.archiveFolder).toBe('SomeArchive')
    expect(mockClient.list).toHaveBeenCalled()
  })
})

`;

// insert before describe('moveEmails'
content = content.replace(
  "describe('moveEmails', () => {",
  archiveTestStr + "describe('moveEmails', () => {"
);

fs.writeFileSync('src/tools/helpers/imap-client.test.ts', content);
