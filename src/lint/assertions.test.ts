import path from 'node:path'

import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const restrictedMessages = (results: ESLint.LintResult[]) =>
  results.flatMap((result) =>
    result.messages.filter((message) => message.ruleId === 'no-restricted-syntax'),
  )

describe('assertion-free lint gate', () => {
  it('rejects assertions in TypeScript and TSX', async () => {
    const eslint = new ESLint({ cwd: process.cwd() })

    const cases = [
      { code: 'declare const value: unknown\nconst one = value as string\n', jsx: false },
      {
        code: 'declare const value: unknown\nconst two = value as unknown as string\n',
        jsx: false,
      },
      { code: 'const three = { value: 1 } as const\n', jsx: false },
      { code: 'declare const value: string | undefined\nconst four = value!\n', jsx: false },
      {
        code: 'declare const value: unknown\nconst view = <div>{value as string}</div>\n',
        jsx: true,
      },
    ]

    const results = await Promise.all(
      cases.map(({ code, jsx }) =>
        eslint.lintText(code, {
          filePath: path.resolve(jsx ? 'src/components/Greeting.tsx' : 'src/errors.ts'),
        }),
      ),
    )

    expect(restrictedMessages(results.flat())).toHaveLength(6)
  })

  it('allows import aliases and satisfies', async () => {
    const eslint = new ESLint({ cwd: process.cwd() })

    const results = await eslint.lintText(
      "import { APIError as PayloadAPIError } from 'payload'\nconst value = { code: 'OK' } satisfies { code: string }\nvoid PayloadAPIError\nvoid value\n",
      { filePath: path.resolve('src/errors.ts') },
    )

    expect(restrictedMessages(results)).toHaveLength(0)
  })
})
