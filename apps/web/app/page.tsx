import { redirect } from 'next/navigation'

export default async function Home() {
  // Redirect to landing page which handles auth and guest mode properly
  redirect('/landing')
}
