import sys

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Replace MailboxObject with ListResponse in import
content = content.replace('type MailboxObject', 'type ListResponse')

# Replace MailboxObject with ListResponse in listFolders
content = content.replace('mb: MailboxObject', 'mb: ListResponse')

with open(file_path, 'w') as f:
    f.write(content)
