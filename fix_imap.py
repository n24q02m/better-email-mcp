import sys

file_path = 'src/tools/helpers/imap-client.ts'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if ';(criteria as any)[criteriaKey] = kvMatch[1]!.replace(/^["\']|["\']$/g, \'\')' in line:
        new_lines.append('      Object.assign(criteria, { [criteriaKey]: kvMatch[1]!.replace(/^["\']|["\']$/g, \'\') })\n')
    else:
        new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
