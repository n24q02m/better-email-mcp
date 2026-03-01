const html = "<html><head><title>Test</title></head><body><script >alert(1);</script ><p>Hello</p><script>unclosed";

const withoutScripts = html
    .replace(/<head\b[^>]*>[\s\S]*?(?:<\/head\s*>|$)/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, '');

console.log(withoutScripts);
