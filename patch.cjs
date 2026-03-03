const fs = require('fs')

const code = fs.readFileSync('src/tools/registry.logic.test.ts', 'utf8')
const toInsert = `
  it('should handle general tool execution errors', async () => {
    // Mock server
    const server = {
      setRequestHandler: vi.fn()
    } as any

    // Mock accounts
    const accounts = [] as any

    // Mock messages tool
    const { messages } = await import('./composite/messages.js');
    vi.mock('./composite/messages.js', () => ({
      messages: vi.fn().mockRejectedValue(new Error('Simulated tool error'))
    }));

    // Re-import registerTools to pick up the mock
    vi.resetModules();
    const { registerTools } = await import('./registry.js');

    // Call registerTools
    registerTools(server, accounts);

    // Find the handler for CallToolRequestSchema
    const callToolHandler = server.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1];

    expect(callToolHandler).toBeDefined();

    // Simulate request that triggers the mocked error
    const request = {
      params: {
        name: 'messages',
        arguments: { action: 'search' }
      }
    };

    const result = await callToolHandler(request);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Simulated tool error')
        }
      ],
      isError: true
    });
  });
`

// Insert the new test block before the final closing brace
const parts = code.split('})')
const newCode = parts.slice(0, parts.length - 1).join('})') + toInsert + '})'

fs.writeFileSync('src/tools/registry.logic.test.ts', newCode)
