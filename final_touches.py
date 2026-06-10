import sys

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Refine formatAddress for better robustness and type safety
new_format_address = """function formatAddress(addr: AddressObject | AddressObject[] | string | undefined | null): string {
  if (!addr) return ''
  if (typeof addr === 'string') return addr

  if (Array.isArray(addr)) {
    return addr.map((a) => formatAddress(a)).filter(Boolean).join(', ')
  }

  if (addr.text) return addr.text

  if (addr.value && Array.isArray(addr.value)) {
    return addr.value
      .map((a: EmailAddress) => {
        if (a.name && a.address) return `${a.name} <${a.address}>`
        return a.address || a.name || ''
      })
      .filter(Boolean)
      .join(', ')
  }
  return ''
}"""

import re
content = re.sub(r'function formatAddress\(addr: AddressObject \| AddressObject\[\] \| string \| undefined \| null\): string \{.*?\}', new_format_address, content, flags=re.DOTALL)

# Remove unnecessary cast in searchEmails
content = content.replace(
    'flags: Array.from((msg.flags as Set<string> | string[]) || []),',
    'flags: Array.from(msg.flags || []),'
)

with open(file_path, 'w') as f:
    f.write(content)
