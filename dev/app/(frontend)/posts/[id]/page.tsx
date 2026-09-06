import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import { branchQueryParamName } from 'payload-plugin-branching'

type Args = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PostPage = async ({ params, searchParams }: Args) => {
  const { id } = await params
  const query = await searchParams
  const activeBranchId = query[branchQueryParamName]
  const payload = await getPayload({ config })

  // The active branch travels as a `?payload-branch=` request param rather
  // than a cookie, so any decoupled client (a separate app, a mobile app,
  // a static build) can select a branch explicitly without relying on
  // same-origin cookies. Payload's local API takes a partial `req`; a bare
  // URLSearchParams is enough for redirectReadToBranch to resolve it.
  const post = await payload.findByID({
    id,
    collection: 'posts',
    req: {
      searchParams: new URLSearchParams(
        typeof activeBranchId === 'string' ? { [branchQueryParamName]: activeBranchId } : {},
      ),
    },
  })

  const backHref =
    typeof activeBranchId === 'string' ? `/?${branchQueryParamName}=${activeBranchId}` : '/'

  return (
    <main className="page">
      <Link className="back-link" href={backHref}>
        Back to posts
      </Link>
      <article className="post-detail">
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>
    </main>
  )
}

export default PostPage
