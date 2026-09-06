import config from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import BranchSwitcher from './components/BranchSwitcher'
import './globals.css'

type Args = {
  children: React.ReactNode
}

// Branch selection here is URL-driven (`?payload-branch=<id>`), not
// cookie-driven: this frontend is meant to demonstrate the decoupled-client
// story (a separate app, a mobile client, a static build), where the
// active branch travels as an explicit request param rather than an
// ambient same-origin cookie. Next.js layouts never receive `searchParams`
// (they'd otherwise opt every route out of static rendering), so the
// active pill is determined client-side in BranchSwitcher via
// `useSearchParams`; this server component only needs the branch list.
const Layout = async ({ children }: Args) => {
  const payload = await getPayload({ config })
  const { docs: branches } = await payload.find({ collection: 'payload-branches' })

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="site-header__title" href="/">
              Payload Branching Demo
            </Link>
            <BranchSwitcher
              branches={branches.map((branch) => ({ id: String(branch.id), name: branch.name }))}
            />
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}

export default Layout
