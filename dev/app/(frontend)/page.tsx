import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'

const PostsPage = async () => {
  const payload = await getPayload({ config })
  // Diverged rows (branch-scoped copies) are real documents but not
  // canonical entry points, visiting one directly always shows that
  // branch's content regardless of the active branch cookie. Only link
  // into base/canonical posts so branch-switching is actually visible.
  const { docs: posts } = await payload.find({
    collection: 'posts',
    where: { branch: { exists: false } },
  })

  return (
    <main>
      <h1>Posts</h1>
      {posts.map((post) => (
        <article key={post.id}>
          <p>{post.content}</p>
          <Link href={`/posts/${post.id}`}>View branch-resolved post</Link>
        </article>
      ))}
    </main>
  )
}

export default PostsPage
