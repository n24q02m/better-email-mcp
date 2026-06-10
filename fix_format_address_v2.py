import sys

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Correct implementation lines
correct_impl = [
    "/**\n",
    " * Format email address from parsed address object\n",
    " */\n",
    "function formatAddress(addr: AddressObject | AddressObject[] | string | undefined | null): string {\n",
    "  if (!addr) return ''\n",
    "  if (typeof addr === 'string') return addr\n",
    "\n",
    "  if (Array.isArray(addr)) {\n",
    "    return addr.map((a) => formatAddress(a)).filter(Boolean).join(', ')\n",
    "  }\n",
    "\n",
    "  if (addr.text) return addr.text\n",
    "\n",
    "  if (addr.value && Array.isArray(addr.value)) {\n",
    "    return addr.value\n",
    "      .map((a: EmailAddress) => {\n",
    "        if (a.name && a.address) return `${a.name} <${a.address}>`\n",
    "        return a.address || a.name || ''\n",
    "      })\n",
    "      .filter(Boolean)\n",
    "      .join(', ')\n",
    "  }\n",
    "  return ''\n",
    "}\n"
]

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "/**" in line and i + 1 < len(lines) and "Format email address from parsed address object" in lines[i+1]:
        new_lines.extend(correct_impl)
        skip = True
    elif skip:
        if "// ============================================================================" in line:
            new_lines.append("\n")
            new_lines.append(line)
            skip = False
        else:
            continue
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
