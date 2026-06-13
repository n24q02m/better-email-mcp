import sys

def apply_merge_diff(file_path, patch_path):
    with open(file_path, 'r') as f:
        content = f.read()

    with open(patch_path, 'r') as f:
        patch = f.read()

    search_start = patch.find('<<<<<<< SEARCH')
    search_end = patch.find('=======')
    replace_start = search_end + len('=======')
    replace_end = patch.find('>>>>>>> REPLACE')

    if search_start == -1 or search_end == -1 or replace_end == -1:
        print("Invalid patch format")
        return False

    search_text = patch[search_start + len('<<<<<<< SEARCH'):search_end].strip('\n')
    replace_text = patch[replace_start:replace_end].strip('\n')

    if search_text not in content:
        print("Search text not found in file")
        # Let's see what's actually there to debug
        # print(f"DEBUG: Looking for:\n'{search_text}'")
        return False

    new_content = content.replace(search_text, replace_text)

    with open(file_path, 'w') as f:
        f.write(new_content)
    return True

if __name__ == "__main__":
    if apply_merge_diff(sys.argv[1], sys.argv[2]):
        print("Patch applied successfully")
    else:
        sys.exit(1)
