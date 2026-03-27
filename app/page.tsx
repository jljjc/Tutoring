import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">WA GATE & Scholarship Prep</h1>
      <p className="text-gray-600 text-center max-w-md">
        Personalised mock tests and AI tutoring for WA Year 6 students.
      </p>
      <div className="flex gap-4">
        <Link href="/auth/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Log In
        </Link>
        <Link href="/auth/signup" className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
          Sign Up
        </Link>
      </div>
    </main>
  )
}
