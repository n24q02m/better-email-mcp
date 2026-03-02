const fs = require('fs')

const file = 'src/tools/registry.logic.test.ts'
let code = fs.readFileSync(file, 'utf8')

const newTest = `  it('should return error for unknown tool', async () => {
    // Mock server
    const server = {
      setRequestHandler: vi.fn()
    } as any

    // Mock accounts
    const accounts = [] as any

    // Call registerTools
    registerTools(server, accounts)

    // Find the handler for CallToolRequestSchema
    const callToolHandler = server.setRequestHandler.mock.calls.find(
      (call: any) => call[0] === CallToolRequestSchema
    )?.[1]

    expect(callToolHandler).toBeDefined()

    // Simulate request with unknown tool name
    const request = {
      params: {
        name: 'this_tool_does_not_exist',
        arguments: {}
      }
    }

    const result = await callToolHandler(request)

    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('Unknown tool: this_tool_does_not_exist')
    expect(result.content[0].text).toContain('UNKNOWN_TOOL')
  })
`

code = code.replace(/}\)\n}\)/, '  })\n\n' + newTest + '})')

fs.writeFileSync(file, code)
