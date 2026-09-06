import config from '@payload-config'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'

import BranchSwitcher from '../../components/BranchSwitcher'

type Args = {
  params: Promise<{ id: string }>
}

const PostPage = async ({ params }: Args) => {
  const { id } = await params
  const payload = await getPayload({ config })
  const cookieStore = await cookies()
  const activeBranchCookie = cookieStore.get('payload-branch')

  const post = await payload.findByID({
    id,
    collection: 'posts',
    req: {
      headers: new Headers(cookieStore.toString() ? [['cookie', cookieStore.toString()]] : []),
    },
  })

  const { docs: branches } = await payload.find({ collection: 'payload-branches' })

  return (
    <main>
      <p>
        <Link href="/">Back to posts</Link>
      </p>
      <h1>Post {id}</h1>
      <BranchSwitcher
        activeBranchId={activeBranchCookie?.value ?? null}
        branches={branches.map((branch) => ({ id: String(branch.id), name: branch.name }))}
      />
      <p>{post.content}</p>
    </main>
  )
}

export default PostPage
