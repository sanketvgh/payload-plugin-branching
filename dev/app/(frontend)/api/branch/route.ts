import { NextResponse } from 'next/server'
import { generateBranchCookie } from 'payload-plugin-branching'

interface Body {
  branchId: null | string
}

export const POST = async (request: Request): Promise<NextResponse> => {
  const { branchId } = (await request.json()) as Body

  const cookie = branchId
    ? generateBranchCookie({ value: branchId })
    : generateBranchCookie({ expires: new Date(0), value: '' })

  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', cookie)
  return response
}
