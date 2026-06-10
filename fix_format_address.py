import sys
import re

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Define the correctly implemented function
correct_implementation = """/**
 * Format email address from parsed address object
 */
function formatAddress(addr: AddressObject | AddressObject[] | string | undefined | null): string {
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

# Find the start of formatAddress and replace until the end of the messed up version
start_pattern = r'/\*\*\s+\* Format email address from parsed address object\s+\*/'
# We'll search for the messed up ending to find the limit
end_marker = r'return \'\'\s+\}\s+<\$\{a\.address\}>` : a\.address\)\)\.join\(\', \'\)\s+\}\s+\}'

# Since the previous regex failed to clean up properly, let's just find the markers and replace
match_start = re.search(start_pattern, content)
match_end = re.search(end_marker, content)

if match_start and match_end:
    new_content = content[:match_start.start()] + correct_implementation + content[match_end.end():]
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("Successfully fixed formatAddress")
else:
    print("Could not find markers to fix formatAddress")
