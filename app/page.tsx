import { redirect } from 'next/navigation';
// Root → dashboard (never redirect to '/' itself)
export default function RootPage() {
  redirect('/dashboard');
}
