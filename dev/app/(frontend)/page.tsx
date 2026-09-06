import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import { branchQueryParamName, resolveBranchedDocs } from 'payload-plugin-branching'

type Args = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PostsPage = async ({ searchParams }: Args) => {
  const payload = await getPayload({ config })
  const params = await searchParams
  const activeBranchId = params[branchQueryParamName]
  const branchQuery =
    typeof activeBranchId === 'string' ? `?${branchQueryParamName}=${activeBranchId}` : ''

  // Diverged rows (branch-scoped copies) are real documents but not
  // canonical entry points, visiting one directly always shows that
  // branch's content regardless of the active branch. Only link into
  // base/canonical posts so branch-switching is actually visible.
  const { docs: canonicalPosts } = await payload.find({
    collection: 'posts',
    where: { branch: { exists: false } },
  })

  // The list query above only ever sees canonical rows; this resolves
  // each one's title/content preview against the active branch's nearest
  // diverged copy (bounded to this page of results), while `href` below
  // still points at the canonical id so the existing findByID redirect
  // keeps working on the detail page.
  const posts = await resolveBranchedDocs({
    branchesSlug: 'payload-branches',
    branchFieldName: 'branch',
    canonicalIdFieldName: 'canonicalId',
    collectionSlug: 'posts',
    docs: canonicalPosts,
    payload,
    req: {
      headers: new Headers(),
      searchParams: new URLSearchParams(
        typeof activeBranchId === 'string' ? { [branchQueryParamName]: activeBranchId } : {},
      ),
    },
  })

  return (
    <main className="page">
      <h1>Posts</h1>
      {posts.length === 0 ? (
        <p className="empty-state">No posts yet.</p>
      ) : (
        <div className="post-list">
          {posts.map((post) => {
            const content = post.content ?? ''
            const excerpt = content.length > 160 ? `${content.slice(0, 160)}…` : content

            return (
              <Link className="post-card" href={`/posts/${post.id}${branchQuery}`} key={post.id}>
                <h2 className="post-card__title">{post.title}</h2>
                <p className="post-card__excerpt">{excerpt}</p>
                <span className="post-card__link">View branch-resolved post →</span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default PostsPage
