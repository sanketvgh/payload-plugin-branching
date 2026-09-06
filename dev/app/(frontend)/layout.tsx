import React from 'react'

type Args = {
  children: React.ReactNode
}

const Layout = ({ children }: Args) => (
  <html lang="en">
    <body>{children}</body>
  </html>
)

export default Layout
