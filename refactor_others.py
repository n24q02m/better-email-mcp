import sys

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Refactor formatAddress
content = content.replace(
    'function formatAddress(addr: any): string {',
    'function formatAddress(addr: AddressObject | AddressObject[] | string | undefined | null): string {'
)
content = content.replace(
    'return addr.value.map((a: any) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(\', \')',
    'return addr.value.map((a: EmailAddress) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(\', \')'
)

# Refactor searchEmails mapper
content = content.replace(
    'const summaries = await mapLimit(emails, 5, async (msg: any) => {',
    'const summaries = await mapLimit(emails, 5, async (msg: FetchMessageObject) => {'
)
content = content.replace(
    'to: msg.envelope?.to?.map((a: any) => a.address).join(\', \') || \'\',',
    'to: msg.envelope?.to?.map((a: MessageAddressObject) => a.address).join(\', \') || \'\','
)

# Refactor readEmail attachment mapping
content = content.replace(
    'attachments: (parsed.attachments || []).map((att: any) => ({',
    'attachments: (parsed.attachments || []).map((att: Attachment) => ({'
)

# Refactor listFolders mapping
content = content.replace(
    'return mailboxes.map((mb: any) => ({',
    'return mailboxes.map((mb: MailboxObject) => ({'
)

with open(file_path, 'w') as f:
    f.write(content)
